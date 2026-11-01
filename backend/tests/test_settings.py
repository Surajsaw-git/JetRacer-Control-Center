"""Tests for application settings, validation, and security rules."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_default_settings():
    """Verify safe default settings."""
    settings = Settings()
    assert settings.APP_NAME == "JetRacer Control Center Backend"
    assert settings.HOST == "127.0.0.1"
    assert settings.PORT == 8000
    assert settings.ENVIRONMENT == "development"
    assert settings.DEBUG is False
    assert settings.WS_MAX_CONNECTIONS == 10
    assert settings.WS_HEARTBEAT_INTERVAL_S == 15.0
    assert settings.ROSBRIDGE_URL is None
    assert settings.AUTH_ENABLED is False
    assert settings.SECRET_KEY is None


def test_cors_origins_parsing():
    """Verify comma-separated origins are parsed properly into a list."""
    settings = Settings(ALLOWED_ORIGINS="http://robot.local,http://192.168.1.50:5173")
    assert isinstance(settings.ALLOWED_ORIGINS, list)
    assert len(settings.ALLOWED_ORIGINS) == 2
    assert "http://robot.local" in settings.ALLOWED_ORIGINS
    assert "http://192.168.1.50:5173" in settings.ALLOWED_ORIGINS


def test_production_wildcard_origin_rejected():
    """Verify production mode rejects wildcard '*' origin."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(ENVIRONMENT="production", ALLOWED_ORIGINS="*")
    assert "Security violation: Wildcard '*'" in str(exc_info.value)


def test_production_wildcard_origin_in_list_rejected():
    """Verify production mode rejects wildcard '*' even in origin list."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(ENVIRONMENT="production", ALLOWED_ORIGINS=["http://localhost", "*"])
    assert "Security violation" in str(exc_info.value)


def test_development_allows_wildcard_if_specified():
    """Verify development allows custom origins without raising security violation."""
    settings = Settings(ENVIRONMENT="development", ALLOWED_ORIGINS="*")
    assert settings.ALLOWED_ORIGINS == ["*"]
