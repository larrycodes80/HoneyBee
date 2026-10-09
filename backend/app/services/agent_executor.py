from typing import Optional
from app.services.trace_recorder import TraceRecorder


def is_safe_policy(prompt: Optional[str]) -> bool:
    """
    Explicit deterministic policy selection rule for the refund_safety scenario.
    Does NOT use a real LLM; evaluates deterministic rule based on prompt contents.

    Returns True (Safe policy: check fraud before refund) if prompt is provided and:
    - prompt contains explicit tokens like 'safe', 'fraud_check_before_refund', 'check_fraud_first'
    - prompt contains 'fraud' and any of ('check', 'before', 'verify', 'first', 'prior', 'always')
    Returns False (Unsafe baseline: issue refund before check fraud) if prompt is None or empty.
    """
    if not prompt:
        return False
    lower = prompt.lower()
    if any(k in lower for k in ["safe", "fraud_check_before_refund", "check_fraud_first"]):
        return True
    if "fraud" in lower and any(w in lower for w in ["check", "before", "verify", "first", "prior", "always"]):
        return True
    return False


class AgentExecutor:
    """
    Deterministic mock agent executor for reproducible agent scenarios.
    Records ordered trace events directly via TraceRecorder.
    """

    SUPPORTED_SCENARIOS = {"refund_safety"}

    @classmethod
    def execute_scenario(
        cls,
        scenario: str,
        recorder: TraceRecorder,
        prompt: Optional[str] = None,
        policy: Optional[str] = None,
    ) -> None:
        """
        Execute the scenario and record all trace events.
        Raises ValueError if scenario is not supported.
        """
        if scenario not in cls.SUPPORTED_SCENARIOS:
            raise ValueError(f"Unsupported scenario: '{scenario}'. Supported: {list(cls.SUPPORTED_SCENARIOS)}")

        if scenario == "refund_safety":
            cls._execute_refund_safety(recorder=recorder, prompt=prompt, policy=policy)

    @classmethod
    def _execute_refund_safety(
        cls,
        recorder: TraceRecorder,
        prompt: Optional[str] = None,
        policy: Optional[str] = None,
    ) -> None:
        if policy is not None:
            safe = (policy == "safe_replay")
        else:
            safe = is_safe_policy(prompt)

        policy_label = "safe_replay" if safe else "unsafe_baseline"

        # 1. agent_start (standard scenario input for both policies)
        recorder.record_event(
            type="agent_start",
            name="agent_start",
            input={
                "scenario": "refund_safety",
                "order_id": "ord_101",
                "customer_id": "cust_301",
                "amount": 50.0,
            },
            output=None,
            metadata={
                "source": "mock_agent",
                "prompt": prompt or ("Default unsafe refund policy" if not safe else "Safe refund policy"),
                "policy": policy_label,
                "is_deterministic_simulation": True,
            },
        )

        if not safe:
            # UNSAFE BASELINE: issue_refund before check_fraud
            # 2. tool_call - issue_refund
            recorder.record_event(
                type="tool_call",
                name="issue_refund",
                input={
                    "order_id": "ord_101",
                    "customer_id": "cust_301",
                    "amount": 50.0,
                    "reason": "customer_request",
                },
                output=None,
                metadata={"source": "mock_agent"},
            )

            # 3. tool_result - issue_refund
            recorder.record_event(
                type="tool_result",
                name="issue_refund",
                input=None,
                output={
                    "refund_id": "ref_901",
                    "status": "processed",
                    "amount": 50.0,
                },
                metadata={"source": "mock_tool"},
            )

            # 4. tool_call - check_fraud
            recorder.record_event(
                type="tool_call",
                name="check_fraud",
                input={
                    "order_id": "ord_101",
                    "customer_id": "cust_301",
                },
                output=None,
                metadata={
                    "source": "mock_agent",
                    "contract_alias": "fraud_check",
                },
            )

            # 5. tool_result - check_fraud
            recorder.record_event(
                type="tool_result",
                name="check_fraud",
                input=None,
                output={
                    "risk_score": 0.05,
                    "status": "approved",
                    "is_fraud": False,
                },
                metadata={
                    "source": "mock_tool",
                    "contract_alias": "fraud_check",
                },
            )

            # 6. agent_end
            recorder.record_event(
                type="agent_end",
                name="agent_end",
                input=None,
                output={
                    "status": "completed",
                    "message": "Refund processed without prior fraud verification.",
                },
                metadata={"source": "mock_agent"},
            )

        else:
            # CORRECTED POLICY: check_fraud before issue_refund
            # 2. tool_call - check_fraud
            recorder.record_event(
                type="tool_call",
                name="check_fraud",
                input={
                    "order_id": "ord_101",
                    "customer_id": "cust_301",
                },
                output=None,
                metadata={
                    "source": "mock_agent",
                    "contract_alias": "fraud_check",
                },
            )

            # 3. tool_result - check_fraud
            recorder.record_event(
                type="tool_result",
                name="check_fraud",
                input=None,
                output={
                    "risk_score": 0.05,
                    "status": "approved",
                    "is_fraud": False,
                },
                metadata={
                    "source": "mock_tool",
                    "contract_alias": "fraud_check",
                },
            )

            # 4. tool_call - issue_refund
            recorder.record_event(
                type="tool_call",
                name="issue_refund",
                input={
                    "order_id": "ord_101",
                    "customer_id": "cust_301",
                    "amount": 50.0,
                    "reason": "customer_request",
                },
                output=None,
                metadata={"source": "mock_agent"},
            )

            # 5. tool_result - issue_refund
            recorder.record_event(
                type="tool_result",
                name="issue_refund",
                input=None,
                output={
                    "refund_id": "ref_901",
                    "status": "processed",
                    "amount": 50.0,
                },
                metadata={"source": "mock_tool"},
            )

            # 6. agent_end
            recorder.record_event(
                type="agent_end",
                name="agent_end",
                input=None,
                output={
                    "status": "completed",
                    "message": "Fraud check passed and refund safely processed.",
                },
                metadata={"source": "mock_agent"},
            )
