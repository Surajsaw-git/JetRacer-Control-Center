"""Tests for RequestIdMiddleware, AccessLogMiddleware, and SecurityHeadersMiddleware."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def client():
    app = create_app(Settings(ENVIRONMENT="test", DEBUG=False))
    with TestClient(app) as c:
        yield c


def test_generated_request_id_in_header(client):
    """Verify responses include an auto-generated X-Request-ID header."""
    response = client.get("/api/health")
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert len(req_id) >= 16


def test_custom_safe_request_id_accepted(client):
    """Verify valid incoming X-Request-ID is retained."""
    custom_id = "operator-session-12345"
    response = client.get("/api/health", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_id


def test_unsafe_request_id_replaced(client):
    """Verify unsafe X-Request-ID with invalid characters is replaced with a safe UUID."""
    unsafe_id = "invalid; injection <script>alert(1)</script>"
    response = client.get("/api/health", headers={"X-Request-ID": unsafe_id})
    assert response.status_code == 200
    assigned_id = response.headers.get("X-Request-ID")
    assert assigned_id != unsafe_id
    assert ";" not in assigned_id
    assert "<" not in assigned_id


def test_security_headers_present(client):
    """Verify security headers are applied to responses."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("Referrer-Policy") == "no-referrer"
    assert "no-store" in response.headers.get("Cache-Control", "")
