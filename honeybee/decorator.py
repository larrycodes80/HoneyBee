import time
import inspect
import functools
from datetime import datetime, timezone
from typing import Optional, Any, Callable

from honeybee.context import ActiveRunContext, set_current_run, reset_current_run


def create_trace_decorator(
    client: Any,
    name: Optional[str] = None,
    workflow_id: Optional[str] = None,
    workflow_version: Optional[str] = None,
    scenario: Optional[str] = None,
) -> Callable:
    """
    Constructs a function decorator that traces synchronous and asynchronous agent functions.
    """

    def decorator(fn: Callable) -> Callable:
        target_name = name or fn.__name__
        is_async = inspect.iscoroutinefunction(fn)

        def _prepare_run_and_start(args: tuple, kwargs: dict) -> tuple[str, Any, dict]:
            # 1. Bind arguments to signature
            try:
                sig = inspect.signature(fn)
                bound = sig.bind(*args, **kwargs)
                bound.apply_defaults()
                raw_inputs = dict(bound.arguments)
            except Exception:
                raw_inputs = {"args": [str(a) for a in args], "kwargs": {k: str(v) for k, v in kwargs.items()}}

            # 2. Redact inputs if capture_input is enabled
            if client.capture_input:
                redacted_inputs = client.redactor.redact(raw_inputs)
            else:
                redacted_inputs = {"omitted": True}

            # 3. Start run on backend
            run_id = client.start_run(
                workflow_id=workflow_id,
                workflow_version=workflow_version,
                scenario=scenario or target_name,
                prompt=str(redacted_inputs.get("prompt") or redacted_inputs.get("message") or ""),
                config={"function_name": target_name, "is_async": is_async},
            )

            # 4. Set context
            active_ctx = ActiveRunContext(
                run_id=run_id,
                client=client,
                workflow_id=workflow_id,
                workflow_version=workflow_version,
            )
            token = set_current_run(active_ctx)

            # 5. Emit agent_start event
            client.record_event(
                type="agent_start",
                name=target_name,
                input=redacted_inputs,
                output=None,
                metadata={"workflow_id": workflow_id, "is_async": is_async},
                run_id=run_id,
            )

            return run_id, token, redacted_inputs

        def _handle_success(run_id: str, start_time: float, result: Any) -> None:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            if client.capture_output:
                redacted_output = client.redactor.redact(result)
            else:
                redacted_output = {"omitted": True}

            client.record_event(
                type="agent_end",
                name=target_name,
                input=None,
                output=redacted_output,
                metadata={"duration_ms": duration_ms, "status": "completed"},
                run_id=run_id,
            )
            client.finalize_run(run_id=run_id, status="completed", summary={"duration_ms": duration_ms})

        def _handle_error(run_id: str, start_time: float, exc: Exception) -> None:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            err_data = {
                "error_type": type(exc).__name__,
                "message": str(exc),
            }
            client.record_event(
                type="error",
                name=type(exc).__name__,
                input=err_data,
                output=None,
                metadata={"duration_ms": duration_ms},
                run_id=run_id,
            )
            client.record_event(
                type="agent_end",
                name=target_name,
                input=None,
                output={"status": "failed", "error": str(exc)},
                metadata={"duration_ms": duration_ms, "status": "failed"},
                run_id=run_id,
            )
            client.finalize_run(
                run_id=run_id,
                status="failed",
                error=str(exc),
                summary={"duration_ms": duration_ms, "error_count": 1},
            )

        if is_async:

            @functools.wraps(fn)
            async def async_wrapper(*args, **kwargs):
                run_id, token, _ = _prepare_run_and_start(args, kwargs)
                start_time = time.perf_counter()
                try:
                    res = await fn(*args, **kwargs)
                    _handle_success(run_id, start_time, res)
                    return res
                except Exception as exc:
                    _handle_error(run_id, start_time, exc)
                    raise
                finally:
                    reset_current_run(token)

            return async_wrapper

        else:

            @functools.wraps(fn)
            def sync_wrapper(*args, **kwargs):
                run_id, token, _ = _prepare_run_and_start(args, kwargs)
                start_time = time.perf_counter()
                try:
                    res = fn(*args, **kwargs)
                    _handle_success(run_id, start_time, res)
                    return res
                except Exception as exc:
                    _handle_error(run_id, start_time, exc)
                    raise
                finally:
                    reset_current_run(token)

            return sync_wrapper

    return decorator
