import json
import pytest
from unittest.mock import patch, MagicMock
import httpx

from app.core.config import get_settings
from app.services.ai_provider import (
    OllamaProvider,
    get_ai_provider,
    AIModelUnavailableError,
    AITimeoutError,
    AIMalformedResponseError,
    AuditResult,
)


def test_ollama_provider_initialization():
    provider = OllamaProvider()
    assert provider.model == "qwen3.5-4b"
    assert provider.base_url == "http://localhost:11434"
    assert provider.timeout_seconds == 120
    assert provider.fallback_on_unavailable is True


def test_ollama_json_extraction():
    provider = OllamaProvider()

    # Raw JSON
    raw = '{"goal": "Test workflow"}'
    assert provider._extract_json(raw) == {"goal": "Test workflow"}

    # Markdown code fence JSON
    fence = '```json\n{"goal": "Test workflow"}\n```'
    assert provider._extract_json(fence) == {"goal": "Test workflow"}

    # Content with text and braces
    surrounded = 'Here is the output: {"goal": "Test workflow"} Hope this helps!'
    assert provider._extract_json(surrounded) == {"goal": "Test workflow"}

    # Invalid JSON
    with pytest.raises(AIMalformedResponseError):
        provider._extract_json("not valid json at all")


def test_ollama_audit_trace_mocked_success():
    provider = OllamaProvider(fallback_on_unavailable=False)

    mock_audit_payload = {
        "status": "passed",
        "verdict": "PASS",
        "summary": "Execution conformed to constraints.",
        "expected_behavior": "Check fraud before refund.",
        "observed_behavior": "Fraud checked and refund issued.",
        "first_divergence_event_id": None,
        "evidence_event_ids": ["evt-1"],
        "reason": "Safety constraints verified.",
        "suggested_correction": "None",
        "findings": [],
        "limitations": None,
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(mock_audit_payload),
                }
            }
        ]
    }

    with patch("httpx.Client.post", return_value=mock_response):
        result = provider.audit_trace(
            intent="Check fraud before refund",
            events=[{"id": "evt-1", "type": "tool_call", "name": "check_fraud"}],
        )

        assert isinstance(result, AuditResult)
        assert result.verdict == "PASS"
        assert result.provider_metadata["provider"] == "ollama"
        assert result.provider_metadata["model"] == "qwen3.5-4b"
        assert result.provider_metadata["real_inference_attempted"] is True


def test_ollama_uninstalled_model_fallback():
    # Model not present on machine (returns 404), fallback_on_unavailable=True
    provider = OllamaProvider(fallback_on_unavailable=True)

    result = provider.audit_trace(
        intent="Check fraud before refund",
        events=[
            {"id": "evt-1", "type": "tool_call", "name": "check_fraud"},
            {"id": "evt-2", "type": "tool_call", "name": "issue_refund"},
        ],
    )

    assert isinstance(result, AuditResult)
    assert result.provider_metadata["provider"] == "deterministic_test_provider"
    assert result.provider_metadata["target_provider"] == "ollama"
    assert result.provider_metadata["model"] == "qwen3.5-4b"
    assert "fallback_reason" in result.provider_metadata


def test_ollama_uninstalled_model_raises_when_no_fallback():
    provider = OllamaProvider(fallback_on_unavailable=False)

    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_response.text = '{"error":{"message":"model not found"}}'

    with patch("httpx.Client.post", return_value=mock_response):
        with pytest.raises(AIModelUnavailableError):
            provider.audit_trace(
                intent="Check fraud",
                events=[],
            )


def test_get_ai_provider_resolves_ollama():
    with patch.object(get_settings(), "honeybee_llm_provider", "ollama"):
        provider = get_ai_provider()
        assert isinstance(provider, OllamaProvider)
        assert provider.model == "qwen3.5-4b"
