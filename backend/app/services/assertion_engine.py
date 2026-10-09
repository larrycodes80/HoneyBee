from typing import Optional
from app.models.trace_event import TraceEvent
from app.schemas.assertions import AssertionResultSchema, AssertionResponse


class AssertionEngine:
    """
    Evaluates behavioral assertions against actual recorded trace events.
    Guarantees assertions are computed from real trace history rather than hardcoded states.
    """

    @classmethod
    def evaluate_assertions(cls, events: list[TraceEvent], run_id: str) -> AssertionResponse:
        results = [cls._evaluate_fraud_check_before_refund(events)]
        return AssertionResponse(run_id=run_id, results=results)

    @classmethod
    def _evaluate_fraud_check_before_refund(
        cls,
        events: list[TraceEvent],
    ) -> AssertionResultSchema:
        fraud_tool_call: Optional[TraceEvent] = None
        fraud_tool_result: Optional[TraceEvent] = None
        refund_tool_call: Optional[TraceEvent] = None

        for evt in events:
            if evt.type == "tool_call" and evt.name in ("check_fraud", "fraud_check"):
                if fraud_tool_call is None:
                    fraud_tool_call = evt
            elif evt.type == "tool_result" and evt.name in ("check_fraud", "fraud_check"):
                if fraud_tool_result is None:
                    fraud_tool_result = evt
            elif evt.type == "tool_call" and evt.name == "issue_refund":
                if refund_tool_call is None:
                    refund_tool_call = evt

        # Scenario 1: A refund was issued
        if refund_tool_call is not None:
            if fraud_tool_call is None:
                return AssertionResultSchema(
                    name="fraud_check_before_refund",
                    passed=False,
                    message="issue_refund was called without any prior fraud check.",
                )

            if refund_tool_call.sequence < fraud_tool_call.sequence:
                return AssertionResultSchema(
                    name="fraud_check_before_refund",
                    passed=False,
                    message=(
                        f"issue_refund occurred at sequence {refund_tool_call.sequence} "
                        f"before fraud check at sequence {fraud_tool_call.sequence}."
                    ),
                )

            if fraud_tool_result is None or refund_tool_call.sequence < fraud_tool_result.sequence:
                return AssertionResultSchema(
                    name="fraud_check_before_refund",
                    passed=False,
                    message=(
                        f"issue_refund occurred at sequence {refund_tool_call.sequence} "
                        "before fraud check result was completed."
                    ),
                )

            # Fraud check call and result were both recorded before issue_refund
            return AssertionResultSchema(
                name="fraud_check_before_refund",
                passed=True,
                message="Fraud check completed successfully before issue_refund was called.",
            )

        # Scenario 2: No refund was issued
        if fraud_tool_result is not None:
            return AssertionResultSchema(
                name="fraud_check_before_refund",
                passed=True,
                message="Fraud check completed and no premature refund was issued.",
            )

        return AssertionResultSchema(
            name="fraud_check_before_refund",
            passed=True,
            message="No refund action was performed.",
        )
