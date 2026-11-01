"""Uniform error hierarchy and exception handlers."""

import logging
from typing import Any, Dict, List, Optional

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import request_id_ctx

logger = logging.getLogger("app.core.errors")


class AppError(Exception):
    """Base application error with structured status code and machine-readable code."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class NotFoundError(AppError):
    """Requested resource does not exist."""

    def __init__(self, message: str = "Resource not found", details: Optional[Any] = None) -> None:
        super().__init__(message=message, code="NOT_FOUND", status_code=404, details=details)


class ValidationFailedError(AppError):
    """Input payload failed schema or semantic validation."""

    def __init__(self, message: str = "Validation failed", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message, code="VALIDATION_FAILED", status_code=422, details=details
        )


class ServiceUnavailableError(AppError):
    """Subsystem or dependency is temporarily unavailable."""

    def __init__(self, message: str = "Service unavailable", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message, code="SERVICE_UNAVAILABLE", status_code=503, details=details
        )


def build_error_envelope(
    code: str,
    message: str,
    details: Optional[Any] = None,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Construct uniform JSON error envelope."""
    req_id = request_id or request_id_ctx.get() or None
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": req_id,
        }
    }


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handle domain AppError instances."""
    logger.warning("Domain error [%s]: %s (details: %s)", exc.code, exc.message, exc.details)
    content = build_error_envelope(
        code=exc.code,
        message=exc.message,
        details=exc.details,
    )
    return JSONResponse(status_code=exc.status_code, content=content)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle FastAPI and Pydantic validation errors (422)."""
    errors: List[Dict[str, Any]] = []
    for err in exc.errors():
        loc = ".".join(str(item) for item in err.get("loc", []))
        errors.append(
            {
                "field": loc,
                "message": err.get("msg", "Invalid value"),
                "type": err.get("type", "value_error"),
            }
        )

    logger.info("Validation error on %s %s: %s", request.method, request.url.path, errors)
    content = build_error_envelope(
        code="VALIDATION_ERROR",
        message="Request payload or parameters failed validation.",
        details=errors,
    )
    return JSONResponse(status_code=422, content=content)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle standard Starlette HTTPExceptions (e.g. 404, 405)."""
    code_map = {
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        403: "FORBIDDEN",
        401: "UNAUTHORIZED",
    }
    code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
    content = build_error_envelope(
        code=code,
        message=str(exc.detail),
    )
    return JSONResponse(status_code=exc.status_code, content=content)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all 500 handler ensuring zero internal detail leakage to the client."""
    req_id = request_id_ctx.get() or "unknown"
    logger.exception("Unhandled server exception processing request [%s]: %s", req_id, str(exc))

    content = build_error_envelope(
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected server error occurred. Please refer to request ID for support.",
        details=None,
        request_id=req_id,
    )
    return JSONResponse(status_code=500, content=content)
