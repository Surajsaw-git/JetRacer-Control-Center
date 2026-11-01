"""HTTP middlewares: Request ID tracing, structured access logging, and security headers."""

import logging
import re
import time
import uuid
from typing import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import request_id_ctx

logger = logging.getLogger("app.access")

# Safe request ID pattern: alphanumeric and hyphens, up to 64 chars
SAFE_REQUEST_ID_REGEX = re.compile(r"^[a-zA-Z0-9\-_]{1,64}$")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Ensure every HTTP request has a validated or newly generated correlation ID."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming_id = request.headers.get("X-Request-ID")
        if incoming_id and SAFE_REQUEST_ID_REGEX.match(incoming_id):
            req_id = incoming_id
        else:
            req_id = str(uuid.uuid4())

        token = request_id_ctx.set(req_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx.reset(token)


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Log incoming HTTP requests with latency metrics and request correlation IDs."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000.0

        req_id = request_id_ctx.get() or "-"
        logger.info(
            "%s %s -> %d in %.2fms [request_id=%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            req_id,
        )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach baseline HTTP security and caching headers."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"

        # Apply strict no-store cache controls on API endpoints
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        return response
