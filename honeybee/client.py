import time
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Any, Callable, Set, Union
import httpx

from honeybee.exceptions import HoneyBeeError, HoneyBeeDeliveryError
from honeybee.models import TraceEvent, Run
from honeybee.redaction import Redactor
from honeybee.context import ActiveRunContext, get_current_run, set_current_run, reset_current_run
from honeybee.decorator import create_trace_decorator

logger = logging.getLogger("honeybee")


class HoneyBee:
    """
    HoneyBee Python SDK client for instrumentation, trace recording, and run lifecycle management.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        workflow_id: Optional[str] = None,
        workflow_version: Optional[str] = None,
        client: Optional[Any] = None,
        redact_keys: Optional[Set[str]] = None,
        redact_fn: Optional[Callable[[str, Any], Any]] = None,
        capture_input: bool = True,
        capture_output: bool = True,
        fail_fast: bool = True,
        timeout: float = 10.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.workflow_id = workflow_id
        self.workflow_version = workflow_version
        self.capture_input = capture_input
        self.capture_output = capture_output
        self.fail_fast = fail_fast
        self.timeout = timeout

        self.redactor = Redactor(redact_keys=redact_keys, redact_fn=redact_fn)

        # Allow passing existing httpx.Client or FastAPI TestClient
        if client is not None:
            self._http_client = client
            self._owns_client = False
        else:
            self._http_client = httpx.Client(base_url=self.base_url, timeout=self.timeout)
            self._owns_client = True

    def _post(self, path: str, json: Any) -> httpx.Response:
        url = f"{self.base_url}{path}" if not hasattr(self._http_client, "base_url") else path
        try:
            res = self._http_client.post(url, json=json)
            if res.status_code >= 400:
                msg = f"HTTP {res.status_code} on {path}: {res.text}"
                if self.fail_fast:
                    raise HoneyBeeDeliveryError(msg, status_code=res.status_code, response_body=res.text)
                logger.warning(msg)
            return res
        except HoneyBeeDeliveryError:
            raise
        except Exception as exc:
            msg = f"Failed to deliver payload to HoneyBee backend at {path}: {exc}"
            if self.fail_fast:
                raise HoneyBeeDeliveryError(msg) from exc
            logger.warning(msg)
            # Create a mock failed response if not failing fast
            return httpx.Response(status_code=500, request=httpx.Request("POST", url))

    def _get(self, path: str) -> httpx.Response:
        url = f"{self.base_url}{path}" if not hasattr(self._http_client, "base_url") else path
        try:
            res = self._http_client.get(url)
            if res.status_code >= 400:
                msg = f"HTTP {res.status_code} on {path}: {res.text}"
                if self.fail_fast:
                    raise HoneyBeeDeliveryError(msg, status_code=res.status_code, response_body=res.text)
                logger.warning(msg)
            return res
        except HoneyBeeDeliveryError:
            raise
        except Exception as exc:
            msg = f"Failed GET request to HoneyBee backend at {path}: {exc}"
            if self.fail_fast:
                raise HoneyBeeDeliveryError(msg) from exc
            logger.warning(msg)
            return httpx.Response(status_code=500, request=httpx.Request("GET", url))

    def start_run(
        self,
        run_id: Optional[str] = None,
        workflow_id: Optional[str] = None,
        workflow_version: Optional[str] = None,
        scenario: Optional[str] = "custom_agent",
        prompt: Optional[str] = None,
        config: Optional[dict[str, Any]] = None,
    ) -> str:
        """
        Initialize a new Run on the HoneyBee backend.
        """
        rid = run_id or f"run_{uuid.uuid4().hex[:8]}"
        wid = workflow_id or self.workflow_id
        wver = workflow_version or self.workflow_version

        payload = {
            "run_id": rid,
            "workflow_id": wid,
            "workflow_version": wver,
            "scenario": scenario or "custom_agent",
            "prompt": prompt or "",
            "config": self.redactor.redact(config or {}),
        }

        res = self._post("/api/runs/init", json=payload)
        if res.status_code == 201:
            data = res.json()
            return data["run"]["id"]
        return rid

    def record_event(
        self,
        type: str,
        name: str,
        input: Optional[Any] = None,
        output: Optional[Any] = None,
        metadata: Optional[dict[str, Any]] = None,
        run_id: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> TraceEvent:
        """
        Record an internal event (tool call, model input/output, tool result, etc.)
        for the active or specified run.
        """
        active_ctx = get_current_run()
        target_run_id = run_id or (active_ctx.run_id if active_ctx else None)

        if not target_run_id:
            raise HoneyBeeError(
                "No active run found. Call record_event within a @hb.trace decorated function "
                "or supply run_id explicitly."
            )

        if active_ctx and target_run_id == active_ctx.run_id:
            active_ctx.sequence += 1
            seq = active_ctx.sequence
        else:
            seq = None

        redacted_input = self.redactor.redact(input) if input is not None else None
        redacted_output = self.redactor.redact(output) if output is not None else None
        redacted_meta = self.redactor.redact(metadata) if metadata is not None else {}

        event_time = timestamp or datetime.now(timezone.utc)
        evt_payload = {
            "type": type,
            "name": name,
            "sequence": seq,
            "input": redacted_input,
            "output": redacted_output,
            "metadata": redacted_meta,
            "timestamp": event_time.isoformat(),
        }

        self._post(f"/api/runs/{target_run_id}/events", json={"events": [evt_payload]})

        return TraceEvent(
            type=type,
            name=name,
            sequence=seq,
            timestamp=event_time,
            input=redacted_input,
            output=redacted_output,
            metadata=redacted_meta,
        )

    def finalize_run(
        self,
        run_id: str,
        status: str = "completed",
        error: Optional[str] = None,
        summary: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Finalize a run's status and summary on the backend.
        """
        payload = {
            "status": status,
            "error": error,
            "summary": summary or {},
        }
        res = self._post(f"/api/runs/{run_id}/finalize", json=payload)
        if res.status_code == 200:
            return res.json()
        return {"status": status, "run_id": run_id}

    def get_run(self, run_id: str) -> dict[str, Any]:
        """Fetch run details and events by run ID."""
        res = self._get(f"/api/runs/{run_id}")
        return res.json()

    def get_diff(self, baseline_run_id: str, replay_run_id: str) -> dict[str, Any]:
        """Fetch trace diff between two runs."""
        res = self._get(f"/api/runs/{baseline_run_id}/diff/{replay_run_id}")
        return res.json()

    def get_assertions(self, run_id: str) -> dict[str, Any]:
        """Evaluate and fetch behavioral assertions for a run."""
        res = self._get(f"/api/runs/{run_id}/assertions")
        return res.json()

    def trace(
        self,
        fn: Optional[Callable] = None,
        *,
        name: Optional[str] = None,
        workflow_id: Optional[str] = None,
        workflow_version: Optional[str] = None,
        scenario: Optional[str] = None,
    ):
        """
        Decorator to automatically record execution of an agent function.
        Can be used as `@hb.trace` or `@hb.trace(name='...')`.
        """
        decorator = create_trace_decorator(
            client=self,
            name=name,
            workflow_id=workflow_id or self.workflow_id,
            workflow_version=workflow_version or self.workflow_version,
            scenario=scenario,
        )
        if fn is not None:
            return decorator(fn)
        return decorator

    def close(self):
        """Close the underlying HTTP client if owned."""
        if self._owns_client and hasattr(self._http_client, "close"):
            self._http_client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
