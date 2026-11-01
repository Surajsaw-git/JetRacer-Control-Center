"""Main FastAPI application factory and lifespan orchestration."""

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import (
    AppError,
    app_error_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_error_handler,
)
from app.core.lifecycle import run_shutdown_hooks, run_startup_hooks
from app.core.logging import setup_logging
from app.core.middleware import (
    AccessLogMiddleware,
    RequestIdMiddleware,
    SecurityHeadersMiddleware,
)
from app.services.ws_manager import ws_manager

logger = logging.getLogger("app.main")


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """Application factory building configured FastAPI instance."""
    app_settings = settings or get_settings()

    # Align WebSocket manager configuration with app settings
    ws_manager._settings = app_settings

    # Configure logging system
    setup_logging(
        log_level=app_settings.LOG_LEVEL,
        log_format=app_settings.LOG_FORMAT,
        log_to_file=app_settings.LOG_TO_FILE,
        log_dir=app_settings.LOG_DIR,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        """Lifespan managing startup verification and graceful shutdown."""
        # Ensure data and log directories exist
        os.makedirs(app_settings.DATA_DIR, exist_ok=True)
        if app_settings.LOG_TO_FILE:
            os.makedirs(app_settings.LOG_DIR, exist_ok=True)

        logger.info(
            "Starting %s v%s (environment=%s, debug=%s)",
            app_settings.APP_NAME,
            app_settings.APP_VERSION,
            app_settings.ENVIRONMENT,
            app_settings.DEBUG,
        )

        # Warning when binding to all interfaces
        if app_settings.HOST == "0.0.0.0":
            logger.warning(
                "SECURITY WARNING: Host bound to 0.0.0.0 (all interfaces). Ensure firewall active."
            )

        if app_settings.DEBUG:
            logger.warning("DEVELOPMENT WARNING: DEBUG mode is active. Disable in production.")

        # Start WebSocket background tasks
        await ws_manager.start()

        # Run registered modular startup hooks
        await run_startup_hooks()

        yield

        logger.info("Initiating graceful shutdown...")
        # Run registered shutdown hooks
        await run_shutdown_hooks()
        # Gracefully stop WebSocket manager and close connections
        await ws_manager.stop()
        logger.info("Shutdown complete.")

    # Conditionally enable interactive OpenAPI docs based on environment
    is_prod = app_settings.ENVIRONMENT.lower() == "production" and not app_settings.DEBUG
    docs_url = None if is_prod else "/docs"
    redoc_url = None if is_prod else "/redoc"
    openapi_url = None if is_prod else "/openapi.json"

    application = FastAPI(
        title=app_settings.APP_NAME,
        version=app_settings.APP_VERSION,
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )

    # Middleware execution pipeline (Starlette executes in reverse order of addition)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(AccessLogMiddleware)
    application.add_middleware(RequestIdMiddleware)

    # CORS Middleware
    origins = (
        app_settings.ALLOWED_ORIGINS
        if isinstance(app_settings.ALLOWED_ORIGINS, list)
        else [app_settings.ALLOWED_ORIGINS]
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=app_settings.ALLOWED_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception Handlers
    # Note: Starlette typing expects Exception; custom subclasses require type ignore
    application.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    application.add_exception_handler(
        RequestValidationError,
        validation_error_handler,  # type: ignore[arg-type]
    )
    application.add_exception_handler(
        StarletteHTTPException,
        http_exception_handler,  # type: ignore[arg-type]
    )
    application.add_exception_handler(Exception, unhandled_exception_handler)

    # Dependency override for settings injection
    application.dependency_overrides[get_settings] = lambda: app_settings

    # Include API Routers
    application.include_router(api_router)

    @application.get("/", tags=["Discovery"])
    async def root() -> Dict[str, Any]:
        """Root discovery endpoint."""
        return {
            "name": app_settings.APP_NAME,
            "version": app_settings.APP_VERSION,
            "environment": app_settings.ENVIRONMENT,
            "docs": docs_url,
            "health": "/api/health",
        }

    return application


# Global application instance for uvicorn ASGI servers
app = create_app()
