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

    SUPPORTED_SCENARIOS = {
        "refund_safety",
        "flagged_fraud_violation",
        "truncated_trace",
        "alternative_safe_order",
    }

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
        elif scenario == "flagged_fraud_violation":
            cls._execute_flagged_fraud_violation(recorder=recorder, prompt=prompt)
        elif scenario == "truncated_trace":
            cls._execute_truncated_trace(recorder=recorder, prompt=prompt)
        elif scenario == "alternative_safe_order":
            cls._execute_alternative_safe_order(recorder=recorder, prompt=prompt)

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

    @classmethod
    def _execute_flagged_fraud_violation(
        cls,
        recorder: TraceRecorder,
        prompt: Optional[str] = None,
    ) -> None:
        """
        Executes a flagged fraud check (is_fraud=True), but agent still proceeds
        to issue a refund — representing a clear explicit requirement violation.
        """
        # 1. agent_start
        recorder.record_event(
            type="agent_start",
            name="agent_start",
            input={"scenario": "flagged_fraud_violation", "order_id": "ord_999", "amount": 75.0},
            output=None,
            metadata={"source": "mock_agent", "prompt": prompt or "Process refund if safe"},
        )
        # 2. check_fraud
        recorder.record_event(
            type="tool_call",
            name="check_fraud",
            input={"order_id": "ord_999"},
            output=None,
            metadata={"source": "mock_agent"},
        )
        # 3. check_fraud result (FLAGGED FRAUD)
        recorder.record_event(
            type="tool_result",
            name="check_fraud",
            input=None,
            output={"risk_score": 0.95, "status": "flagged", "is_fraud": True},
            metadata={"source": "mock_tool"},
        )
        # 4. issue_refund (VIOLATION: refund issued despite positive fraud)
        recorder.record_event(
            type="tool_call",
            name="issue_refund",
            input={"order_id": "ord_999", "amount": 75.0},
            output=None,
            metadata={"source": "mock_agent"},
        )
        # 5. issue_refund result
        recorder.record_event(
            type="tool_result",
            name="issue_refund",
            input=None,
            output={"refund_id": "ref_flagged_err", "status": "processed"},
            metadata={"source": "mock_tool"},
        )
        # 6. agent_end
        recorder.record_event(
            type="agent_end",
            name="agent_end",
            input=None,
            output={"status": "completed", "message": "Refund issued despite fraud flag."},
            metadata={"source": "mock_agent"},
        )

    @classmethod
    def _execute_truncated_trace(
        cls,
        recorder: TraceRecorder,
        prompt: Optional[str] = None,
    ) -> None:
        """
        Executes an incomplete/truncated trace with only agent_start before premature termination.
        """
        recorder.record_event(
            type="agent_start",
            name="agent_start",
            input={"scenario": "truncated_trace"},
            output=None,
            metadata={"source": "mock_agent", "prompt": prompt or "Incomplete trace execution"},
        )

    @classmethod
    def _execute_alternative_safe_order(
        cls,
        recorder: TraceRecorder,
        prompt: Optional[str] = None,
    ) -> None:
        """
        Executes a valid alternative order:
        verify_account -> check_fraud -> issue_refund
        All constraints are satisfied, but extra valid step exists before fraud check.
        """
        # 1. agent_start
        recorder.record_event(
            type="agent_start",
            name="agent_start",
            input={"scenario": "alternative_safe_order", "order_id": "ord_alt_1"},
            output=None,
            metadata={"source": "mock_agent"},
        )
        # 2. verify_account
        recorder.record_event(
            type="tool_call",
            name="verify_account",
            input={"account_id": "acc_001"},
            output=None,
            metadata={"source": "mock_agent"},
        )
        # 3. verify_account result
        recorder.record_event(
            type="tool_result",
            name="verify_account",
            input=None,
            output={"verified": True},
            metadata={"source": "mock_tool"},
        )
        # 4. check_fraud
        recorder.record_event(
            type="tool_call",
            name="check_fraud",
            input={"order_id": "ord_alt_1"},
            output=None,
            metadata={"source": "mock_agent"},
        )
        # 5. check_fraud result
        recorder.record_event(
            type="tool_result",
            name="check_fraud",
            input=None,
            output={"is_fraud": False, "status": "approved"},
            metadata={"source": "mock_tool"},
        )
        # 6. issue_refund
        recorder.record_event(
            type="tool_call",
            name="issue_refund",
            input={"order_id": "ord_alt_1", "amount": 50.0},
            output=None,
            metadata={"source": "mock_agent"},
        )
        # 7. issue_refund result
        recorder.record_event(
            type="tool_result",
            name="issue_refund",
            input=None,
            output={"refund_id": "ref_alt_ok", "status": "processed"},
            metadata={"source": "mock_tool"},
        )
        # 8. agent_end
        recorder.record_event(
            type="agent_end",
            name="agent_end",
            input=None,
            output={"status": "completed", "message": "Alternative workflow succeeded safely."},
            metadata={"source": "mock_agent"},
        )

