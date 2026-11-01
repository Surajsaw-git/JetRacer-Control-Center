"""Core functionality: configuration, errors, logging, lifecycle, and middleware."""

from app.core.config import Settings, get_settings
from app.core.errors import AppError, NotFoundError, ServiceUnavailableError, ValidationFailedError
from app.core.lifecycle import register_shutdown_hook, register_startup_hook
from app.core.logging import setup_logging

__all__ = [
    "Settings",
    "get_settings",
    "AppError",
    "NotFoundError",
    "ValidationFailedError",
    "ServiceUnavailableError",
    "register_startup_hook",
    "register_shutdown_hook",
    "setup_logging",
]
