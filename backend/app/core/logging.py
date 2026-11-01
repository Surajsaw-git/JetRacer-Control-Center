"""Logging configuration with contextvars request tracing and structured formatters."""

import contextvars
import json
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from typing import Any, Dict

# Context variable for correlating log entries with HTTP/WebSocket requests
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


class RequestIdFilter(logging.Filter):
    """Logging filter that injects the current request_id into every LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get() or "-"
        return True


class JsonFormatter(logging.Formatter):
    """Structured JSON formatter for production log ingestion."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging(
    log_level: str = "INFO",
    log_format: str = "text",
    log_to_file: bool = False,
    log_dir: str = "./logs",
) -> None:
    """Configure root logger and formatters."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Clear existing handlers to prevent duplicate lines
    root_logger.handlers.clear()

    # Formatter selection
    if log_format.lower() == "json":
        formatter: logging.Formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(request_id)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )

    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(RequestIdFilter())
    root_logger.addHandler(console_handler)

    # Optional Rotating File Handler
    if log_to_file:
        os.makedirs(log_dir, exist_ok=True)
        file_path = os.path.join(log_dir, "app.log")
        file_handler = RotatingFileHandler(
            filename=file_path,
            maxBytes=5 * 1024 * 1024,  # 5 MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        file_handler.addFilter(RequestIdFilter())
        root_logger.addHandler(file_handler)

    # Suppress verbose duplicate access logs from uvicorn
    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.access").propagate = False
