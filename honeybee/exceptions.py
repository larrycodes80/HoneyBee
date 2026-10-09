from typing import Optional


class HoneyBeeError(Exception):
    """Base exception for all HoneyBee SDK errors."""
    pass


class HoneyBeeDeliveryError(HoneyBeeError):
    """Raised when trace delivery or backend communication fails."""

    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class HoneyBeeConfigError(HoneyBeeError):
    """Raised when HoneyBee configuration or run initialization is invalid."""
    pass
