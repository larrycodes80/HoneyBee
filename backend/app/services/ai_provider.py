import json
import logging
from abc import ABC, abstractmethod
from typing import Optional, Any
import httpx

from app.core.config import get_settings
from app.schemas.workflow import (
    ClarificationQuestion,
    ClarificationQuestionsOutput,
    WorkflowSpecification,
)

logger = logging.getLogger(__name__)


# Standardized AI Provider Exceptions
class AIProviderError(Exception):
    """Base exception for all AI provider inference failures."""
    pass


class AIConfigurationError(AIProviderError):
    """Missing or invalid configuration/credentials for AI provider."""
    pass


class AIAuthenticationError(AIProviderError):
    """Authentication or token rejection from AI provider."""
    pass


class AIRateLimitError(AIProviderError):
    """Rate limit or quota exhaustion from AI provider."""
    pass


class AITimeoutError(AIProviderError):
    """Timeout during model inference."""
    pass


class AIModelUnavailableError(AIProviderError):
    """Requested model identifier is unavailable or down."""
    pass


class AIMalformedResponseError(AIProviderError):
    """Model produced unparseable or schema-violating output."""
    pass


class AIProvider(ABC):
    """Abstract interface for HoneyBee AI model inference providers."""

    @abstractmethod
    def generate_clarification_questions(
        self,
        intent: str,
        existing_q_and_a: Optional[list[dict[str, str]]] = None,
    ) -> ClarificationQuestionsOutput:
        """Generate targeted clarification questions to resolve ambiguity in intent."""
        pass

    @abstractmethod
    def generate_workflow_spec(
        self,
        intent: str,
        q_and_a: Optional[list[dict[str, str]]] = None,
        existing_spec: Optional[dict[str, Any]] = None,
    ) -> WorkflowSpecification:
        """Synthesize a complete structured workflow specification from intent and interview answers."""
        pass


class DigitalOceanGemmaProvider(AIProvider):
    """
    DigitalOcean-hosted Gemma 4 inference integration via HTTP API.
    All calls remain strictly on the backend; secrets are never exposed to clients.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ):
        settings = get_settings()
        self.api_key = api_key or settings.effective_digitalocean_key
        self.base_url = (base_url or settings.digitalocean_inference_base_url).rstrip("/")
        self.model = model or settings.digitalocean_inference_model
        self.timeout_seconds = timeout_seconds or settings.digitalocean_inference_timeout_seconds

        if not self.api_key:
            raise AIConfigurationError(
                "DigitalOcean inference API key is missing. Set DIGITALOCEAN_INFERENCE_API_KEY or DIGITALOCEAN_TOKEN."
            )

    def _call_gemma_chat(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        endpoint = f"{self.base_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }

        try:
            with httpx.Client(timeout=float(self.timeout_seconds)) as client:
                response = client.post(endpoint, headers=headers, json=payload)

            if response.status_code == 401 or response.status_code == 403:
                raise AIAuthenticationError(
                    f"DigitalOcean authentication failed (HTTP {response.status_code}): {response.text}"
                )
            if response.status_code == 429:
                raise AIRateLimitError(
                    f"DigitalOcean inference rate limit reached (HTTP 429): {response.text}"
                )
            if response.status_code == 404 or response.status_code == 503:
                raise AIModelUnavailableError(
                    f"Model '{self.model}' is unavailable on DigitalOcean (HTTP {response.status_code}): {response.text}"
                )
            if response.status_code != 200:
                raise AIProviderError(
                    f"DigitalOcean inference error (HTTP {response.status_code}): {response.text}"
                )

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)

        except httpx.TimeoutException as exc:
            raise AITimeoutError(
                f"DigitalOcean inference timed out after {self.timeout_seconds}s: {exc}"
            ) from exc
        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            raise AIMalformedResponseError(
                f"Failed to parse valid JSON from Gemma model response: {exc}"
            ) from exc
        except httpx.RequestError as exc:
            raise AIProviderError(
                f"Network error communicating with DigitalOcean inference service: {exc}"
            ) from exc

    def generate_clarification_questions(
        self,
        intent: str,
        existing_q_and_a: Optional[list[dict[str, str]]] = None,
    ) -> ClarificationQuestionsOutput:
        system_prompt = (
            "You are HoneyBee's Workflow Interview Engine powered by Gemma 4. "
            "Your task is to analyze developer natural-language workflow intent and generate "
            "3 to 5 precise, critical clarification questions.\n\n"
            "Focus on:\n"
            "1. Safety boundaries and invariants (what must NEVER happen).\n"
            "2. Edge case and error handling (what happens when a check fails or tool errors).\n"
            "3. Hard requirements vs optional developer preferences.\n"
            "4. Permitted alternative sequences or conditional paths.\n\n"
            "Output strictly valid JSON matching this schema:\n"
            "{\n"
            '  "questions": [\n'
            '    {"id": "q1", "question": "...", "category": "safety_boundary", "rationale": "..."}\n'
            "  ]\n"
            "}"
        )

        user_content = json.dumps({
            "intent": intent,
            "existing_interview_history": existing_q_and_a or [],
        })

        parsed = self._call_gemma_chat(system_prompt, f"Analyze this workflow intent:\n{user_content}")
        try:
            return ClarificationQuestionsOutput.model_validate(parsed)
        except Exception as exc:
            raise AIMalformedResponseError(f"Gemma clarification output failed schema validation: {exc}") from exc

    def generate_workflow_spec(
        self,
        intent: str,
        q_and_a: Optional[list[dict[str, str]]] = None,
        existing_spec: Optional[dict[str, Any]] = None,
    ) -> WorkflowSpecification:
        system_prompt = (
            "You are HoneyBee's Workflow Interview Engine powered by Gemma 4. "
            "Convert the developer's intent and interview answers into a formal, structured workflow specification.\n\n"
            "CRITICAL RULES:\n"
            "- Explicitly distinguish hard requirements from developer preferences.\n"
            "- Do NOT equate preferences with safety requirements.\n"
            "- Extract forbidden actions and non-negotiable safety invariants.\n"
            "- Define clear failure-handling requirements.\n\n"
            "Output strictly valid JSON matching this schema:\n"
            "{\n"
            '  "goal": "...",\n'
            '  "required_outcomes": ["..."],\n'
            '  "required_conditions": ["..."],\n'
            '  "forbidden_actions": ["..."],\n'
            '  "safety_invariants": ["..."],\n'
            '  "acceptable_alternatives": ["..."],\n'
            '  "failure_handling_requirements": ["..."],\n'
            '  "success_criteria": ["..."],\n'
            '  "external_side_effects": ["..."],\n'
            '  "unresolved_assumptions": ["..."],\n'
            '  "hard_requirements": ["..."],\n'
            '  "preferences": ["..."]\n'
            "}"
        )

        user_content = json.dumps({
            "intent": intent,
            "interview_answers": q_and_a or [],
            "existing_draft": existing_spec or {},
        })

        parsed = self._call_gemma_chat(system_prompt, f"Synthesize formal workflow specification:\n{user_content}")
        try:
            return WorkflowSpecification.model_validate(parsed)
        except Exception as exc:
            raise AIMalformedResponseError(f"Gemma workflow spec failed schema validation: {exc}") from exc


class FakeGemmaProvider(AIProvider):
    """
    Deterministic fake provider for repeatable automated testing and offline dev.
    Produces high-fidelity clarification questions and structured specifications
    without live network or DigitalOcean API dependencies.
    """

    _simulated_error: Optional[Exception] = None

    @classmethod
    def set_simulated_error(cls, error: Optional[Exception]) -> None:
        cls._simulated_error = error

    @classmethod
    def clear_simulated_error(cls) -> None:
        cls._simulated_error = None

    def generate_clarification_questions(
        self,
        intent: str,
        existing_q_and_a: Optional[list[dict[str, str]]] = None,
    ) -> ClarificationQuestionsOutput:
        if self._simulated_error:
            raise self._simulated_error

        intent_lower = intent.lower()

        questions = [
            ClarificationQuestion(
                id="q_safety_invariants",
                question="What specific criteria or indicators must halt the execution immediately before any irreversible side effects?",
                category="safety_boundary",
                rationale="Ensures non-negotiable safety invariants are explicitly separated from standard business logic.",
            ),
            ClarificationQuestion(
                id="q_failure_handling",
                question="If a dependent verification service times out or errors, should the case be sent to manual review or aborted?",
                category="failure_handling",
                rationale="Prevents unhandled exceptions from silently permitting dangerous default actions.",
            ),
        ]

        if "refund" in intent_lower or "fraud" in intent_lower:
            questions.append(
                ClarificationQuestion(
                    id="q_fraud_threshold",
                    question="What maximum payout amount or risk threshold triggers required human manager authorization?",
                    category="edge_case",
                    rationale="Defines exact boundaries for autonomous vs escalated approvals.",
                )
            )
        else:
            questions.append(
                ClarificationQuestion(
                    id="q_permissions",
                    question="Which external tools or databases is this agent strictly forbidden from mutating?",
                    category="safety_boundary",
                    rationale="Defines the blast-radius boundary of the autonomous workflow.",
                )
            )

        return ClarificationQuestionsOutput(questions=questions)

    def generate_workflow_spec(
        self,
        intent: str,
        q_and_a: Optional[list[dict[str, str]]] = None,
        existing_spec: Optional[dict[str, Any]] = None,
    ) -> WorkflowSpecification:
        if self._simulated_error:
            raise self._simulated_error

        intent_lower = intent.lower()
        answers_text = " ".join([f"{a.get('question', '')} {a.get('answer', '')}" for a in (q_and_a or [])]).lower()

        # Build goal
        goal = intent.strip().split(".")[0] or "Execute safe autonomous agent workflow"

        # Build safety invariants & forbidden actions
        if "fraud" in intent_lower or "refund" in intent_lower:
            forbidden = [
                "Issue refund before fraud verification completes successfully",
                "Disburse customer funds if fraud check risk is positive or flagged",
                "Bypass manual review escalation when transaction exceeds risk threshold",
            ]
            safety = [
                "check_fraud must precede issue_refund in the execution trace",
                "Customer fund balance must never be debited without prior verified order identity",
            ]
            hard_reqs = [
                "Fraud verification step is mandatory for 100% of refund requests",
                "Flagged fraud records must be forwarded to manual investigation queue",
            ]
            conditions = [
                "Transaction order_id and customer_id must exist and match",
                "Fraud check response must report is_fraud=False and risk_score < 0.7",
            ]
            outcomes = [
                "Customer receives refund if and only if risk assessment passes",
                "Audit log records fraud verification outcome prior to disbursement",
            ]
            failures = [
                "If fraud service is unreachable or errors, halt and route to manual review queue",
                "Never disburse funds on fraud verification timeout",
            ]
        else:
            forbidden = ["Execute irreversible side-effects without prior condition verification"]
            safety = ["All required checks must complete before action execution"]
            hard_reqs = ["Pre-conditions must evaluate to true prior to action execution"]
            conditions = ["Target resource verified and authorized"]
            outcomes = ["Task completed with all constraints preserved"]
            failures = ["Halt execution upon unexpected tool error and log diagnostic context"]

        # If user answered questions, incorporate details
        if "manual" in answers_text or "escalat" in answers_text:
            failures.append("Route high-risk or ambiguous cases to human operator dashboard")

        return WorkflowSpecification(
            goal=goal,
            required_outcomes=outcomes,
            required_conditions=conditions,
            forbidden_actions=forbidden,
            safety_invariants=safety,
            acceptable_alternatives=[
                "Account verification or audit logging may occur prior to or concurrent with primary checks",
                "Tool call ordering of non-conflicting read-only validations is acceptable",
            ],
            failure_handling_requirements=failures,
            success_criteria=[
                "Trace completes with status completed and zero unhandled errors",
                "All safety invariants verified across recorded event sequence",
            ],
            external_side_effects=[
                "Disbursement of customer funds",
                "Audit log event creation",
            ],
            unresolved_assumptions=[
                "Upstream payment gateway operates synchronously with deterministic idempotency",
            ],
            hard_requirements=hard_reqs,
            preferences=[
                "Complete total verification within 2.5 seconds where feasible",
                "Prefer cached customer identity check when under 5 minutes old",
            ],
        )


def get_ai_provider() -> AIProvider:
    """
    Factory resolving the active AI inference provider.
    Honors HONEYBEE_LLM_PROVIDER, DIGITALOCEAN_INFERENCE_API_KEY, and fallback modes.
    """
    settings = get_settings()
    provider_type = settings.honeybee_llm_provider.lower().strip()

    if provider_type == "digitalocean":
        if settings.effective_digitalocean_key:
            return DigitalOceanGemmaProvider(
                api_key=settings.effective_digitalocean_key,
                base_url=settings.digitalocean_inference_base_url,
                model=settings.digitalocean_inference_model,
                timeout_seconds=settings.digitalocean_inference_timeout_seconds,
            )
        else:
            logger.warning(
                "HONEYBEE_LLM_PROVIDER is 'digitalocean' but no valid API key is set. Falling back to FakeGemmaProvider."
            )
            return FakeGemmaProvider()

    # Default to FakeGemmaProvider for testing and offline environments
    return FakeGemmaProvider()
