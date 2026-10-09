from contextvars import ContextVar
from typing import Optional, Any


class ActiveRunContext:
    """
    Context-local container for an in-flight HoneyBee run.
    Stores run_id and client reference for child event recording.
    """

    def __init__(
        self,
        run_id: str,
        client: Any,
        workflow_id: Optional[str] = None,
        workflow_version: Optional[str] = None,
    ):
        self.run_id = run_id
        self.client = client
        self.workflow_id = workflow_id
        self.workflow_version = workflow_version
        self.sequence = 0


_current_run_var: ContextVar[Optional[ActiveRunContext]] = ContextVar("honeybee_active_run", default=None)


def get_current_run() -> Optional[ActiveRunContext]:
    """Retrieve the currently active run for the current execution context (thread/task)."""
    return _current_run_var.get()


def set_current_run(ctx: Optional[ActiveRunContext]):
    """Set the active run context and return the context token."""
    return _current_run_var.set(ctx)


def reset_current_run(token) -> None:
    """Reset the active run context back to its previous state."""
    _current_run_var.reset(token)
