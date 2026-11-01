"""Application lifecycle hooks registry for modular subsystem initialization."""

import logging
from typing import Awaitable, Callable, List

logger = logging.getLogger("app.core.lifecycle")

StartupHook = Callable[[], Awaitable[None]]
ShutdownHook = Callable[[], Awaitable[None]]

_startup_hooks: List[StartupHook] = []
_shutdown_hooks: List[ShutdownHook] = []


def register_startup_hook(hook: StartupHook) -> None:
    """Register an asynchronous function to execute during application startup."""
    _startup_hooks.append(hook)


def register_shutdown_hook(hook: ShutdownHook) -> None:
    """Register an asynchronous function to execute during application shutdown."""
    _shutdown_hooks.append(hook)


def clear_lifecycle_hooks() -> None:
    """Clear all registered hooks (primarily for testing isolation)."""
    _startup_hooks.clear()
    _shutdown_hooks.clear()


async def run_startup_hooks() -> None:
    """Execute all registered startup hooks sequentially."""
    for hook in _startup_hooks:
        name = getattr(hook, "__name__", str(hook))
        logger.debug("Executing startup hook: %s", name)
        await hook()


async def run_shutdown_hooks() -> None:
    """Execute all registered shutdown hooks in reverse registration order."""
    for hook in reversed(_shutdown_hooks):
        name = getattr(hook, "__name__", str(hook))
        logger.debug("Executing shutdown hook: %s", name)
        try:
            await hook()
        except Exception:
            logger.exception("Error executing shutdown hook: %s", name)
