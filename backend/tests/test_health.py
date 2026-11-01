"""Tests for health endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify that GET /api/health returns 200 and expected schema and values."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "jetracer-control-center-backend"
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data
