"""Tests for error envelope, AppError subclasses, and exception handlers."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import (
    NotFoundError,
    ServiceUnavailableError,
    ValidationFailedError,
)
from app.main import create_app


@pytest.fixture
def test_app():
    """Create test application with intentional error test endpoints."""
    app = create_app(Settings(ENVIRONMENT="test", DEBUG=False))

    @app.get("/test/custom-not-found")
    async def raise_not_found():
        raise NotFoundError("Custom item was not found", details={"id": 42})

    @app.get("/test/custom-validation")
    async def raise_validation():
        raise ValidationFailedError("Manual validation failed", details=["field_x required"])

    @app.get("/test/custom-unavailable")
    async def raise_unavailable():
        raise ServiceUnavailableError("Hardware service down", details={"subsystem": "motor"})

    @app.get("/test/unhandled-500")
    async def raise_unhandled():
        # Deliberate ZeroDivisionError to test 500 catch-all
        return 1 / 0

    return app


@pytest.fixture
def client(test_app):
    with TestClient(test_app, raise_server_exceptions=False) as c:
        yield c


def test_standard_404_error_envelope(client):
    """Test 404 error envelope structure."""
    response = client.get("/non-existent-path")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    error = data["error"]
    assert error["code"] == "NOT_FOUND"
    assert "message" in error
    assert "request_id" in error


def test_custom_not_found_error(client):
    """Test domain NotFoundError mapped into envelope."""
    response = client.get("/test/custom-not-found")
    assert response.status_code == 404
    data = response.json()
    error = data["error"]
    assert error["code"] == "NOT_FOUND"
    assert error["message"] == "Custom item was not found"
    assert error["details"] == {"id": 42}


def test_custom_validation_error(client):
    """Test domain ValidationFailedError."""
    response = client.get("/test/custom-validation")
    assert response.status_code == 422
    data = response.json()
    error = data["error"]
    assert error["code"] == "VALIDATION_FAILED"
    assert error["details"] == ["field_x required"]


def test_custom_unavailable_error(client):
    """Test domain ServiceUnavailableError."""
    response = client.get("/test/custom-unavailable")
    assert response.status_code == 503
    data = response.json()
    error = data["error"]
    assert error["code"] == "SERVICE_UNAVAILABLE"
    assert error["details"] == {"subsystem": "motor"}


def test_unhandled_500_zero_leakage(client):
    """Test unhandled 500 handler masks traceback and leaks zero internal details."""
    response = client.get("/test/unhandled-500")
    assert response.status_code == 500
    data = response.json()
    assert "error" in data
    error = data["error"]
    assert error["code"] == "INTERNAL_SERVER_ERROR"
    # Ensure raw Python exception details / ZeroDivisionError / Traceback are NOT leaked
    assert "ZeroDivisionError" not in error["message"]
    assert "Traceback" not in error["message"]
    assert error["details"] is None
    assert error["request_id"] is not None
