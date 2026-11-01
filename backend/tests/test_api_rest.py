"""Tests for REST endpoints (health, ready, info, config, ws/stats)."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def client():
    """Create test client with isolated app instance."""
    app = create_app(Settings(ENVIRONMENT="test", DEBUG=False))
    with TestClient(app) as test_client:
        yield test_client


def test_root_discovery(client):
    """Test GET / endpoint returns discovery payload."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert data["health"] == "/api/health"


def test_health_liveness(client):
    """Test GET /api/health returns liveness status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data
    assert "version" in data


def test_health_readiness(client):
    """Test GET /api/health/ready returns readiness payload with honest robot status."""
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert "components" in data
    components = data["components"]
    assert components["settings"]["status"] == "ok"
    assert components["storage"]["status"] == "ok"
    assert components["ws_manager"]["status"] == "ok"
    assert components["robot"]["status"] == "not_integrated"
    assert "Phase 4" in components["robot"]["message"]


def test_system_info(client):
    """Test GET /api/v1/info returns runtime environment and capabilities map."""
    response = client.get("/api/v1/info")
    assert response.status_code == 200
    data = response.json()
    assert data["app_name"] == "JetRacer Control Center Backend"
    assert data["environment"] == "test"
    assert "capabilities" in data

    caps = data["capabilities"]
    assert caps["ros"]["status"] == "not_implemented"
    assert caps["ros"]["planned_phase"] == 4
    assert caps["camera"]["planned_phase"] == 5
    assert caps["lidar"]["planned_phase"] == 6
    assert caps["mapping"]["planned_phase"] == 7
    assert caps["control"]["planned_phase"] == 8
    assert caps["navigation"]["planned_phase"] == 9


def test_system_config_non_secret(client):
    """Test GET /api/v1/config returns sanitized settings without secrets."""
    response = client.get("/api/v1/config")
    assert response.status_code == 200
    data = response.json()
    assert "app_name" in data
    assert "environment" in data
    assert "allowed_origins_count" in data
    # Ensure sensitive fields are not in output
    assert "DATABASE_URL" not in data
    assert "SECRET_KEY" not in data
    assert "database_url" not in data


def test_ws_stats_endpoint(client):
    """Test GET /api/v1/ws/stats returns connection count and rooms."""
    response = client.get("/api/v1/ws/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_connections" in data
    assert "max_connections" in data
    assert "rooms" in data
    assert isinstance(data["rooms"], dict)


def test_docs_disabled_in_production():
    """Verify OpenAPI docs (/docs, /redoc, /openapi.json) are disabled in production."""
    prod_app = create_app(Settings(ENVIRONMENT="production", DEBUG=False))
    with TestClient(prod_app) as prod_client:
        assert prod_client.get("/docs").status_code == 404
        assert prod_client.get("/redoc").status_code == 404
        assert prod_client.get("/openapi.json").status_code == 404
