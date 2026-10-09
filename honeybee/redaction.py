import re
from typing import Any, Callable, Optional, Set

DEFAULT_SENSITIVE_KEYS: Set[str] = {
    "api_key",
    "apikey",
    "secret",
    "password",
    "passwd",
    "token",
    "access_token",
    "auth",
    "authorization",
    "bearer",
    "credential",
    "credentials",
    "private_key",
    "credit_card",
    "card_number",
    "ssn",
    "cvv",
}

# Patterns for values that look like sensitive keys
BEARER_PATTERN = re.compile(r"Bearer\s+([A-Za-z0-9\-_.]+)", re.IGNORECASE)
SECRET_PREFIX_PATTERN = re.compile(r"\b(sk-[A-Za-z0-9_\-]{15,}|ghp_[A-Za-z0-9_\-]{15,}|do_v1_[A-Za-z0-9_\-]{15,})\b")


class Redactor:
    """
    Safely sanitizes and redacts sensitive data from payloads before transmission.
    """

    def __init__(
        self,
        redact_keys: Optional[Set[str]] = None,
        redact_fn: Optional[Callable[[str, Any], Any]] = None,
    ):
        self.sensitive_keys = set(DEFAULT_SENSITIVE_KEYS)
        if redact_keys:
            self.sensitive_keys.update({k.lower() for k in redact_keys})
        self.custom_redact_fn = redact_fn

    def _is_sensitive_key(self, key: str) -> bool:
        lower_key = key.lower()
        if lower_key in self.sensitive_keys:
            return True
        for sens in self.sensitive_keys:
            if sens in lower_key:
                return True
        return False

    def _redact_string(self, value: str) -> str:
        res = BEARER_PATTERN.sub("Bearer [REDACTED]", value)
        res = SECRET_PREFIX_PATTERN.sub("[REDACTED_SECRET]", res)
        return res

    def redact(self, data: Any, current_key: str = "") -> Any:
        """
        Recursively redact sensitive keys and values from data.
        """
        if self.custom_redact_fn:
            custom_result = self.custom_redact_fn(current_key, data)
            if custom_result != data:
                return custom_result

        if data is None or isinstance(data, (int, float, bool)):
            return data

        if isinstance(data, str):
            return self._redact_string(data)

        if isinstance(data, dict):
            redacted_dict = {}
            for k, v in data.items():
                str_k = str(k)
                if self._is_sensitive_key(str_k):
                    redacted_dict[str_k] = "[REDACTED]"
                else:
                    redacted_dict[str_k] = self.redact(v, current_key=str_k)
            return redacted_dict

        if isinstance(data, (list, tuple, set)):
            return [self.redact(item, current_key=current_key) for item in data]

        # For custom objects or Pydantic models
        if hasattr(data, "model_dump"):
            return self.redact(data.model_dump(), current_key=current_key)
        if hasattr(data, "__dict__"):
            clean_dict = {k: v for k, v in data.__dict__.items() if not k.startswith("_")}
            return self.redact(clean_dict, current_key=current_key)

        return self._redact_string(str(data))
