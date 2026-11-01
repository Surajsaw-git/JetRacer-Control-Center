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


def test_allowed_origin_regex_default_unset():
    """Verify ALLOWED_ORIGIN_REGEX defaults to None."""
    settings = Settings()
    assert settings.ALLOWED_ORIGIN_REGEX is None


def test_allowed_origin_regex_valid():
    """Verify valid ALLOWED_ORIGIN_REGEX can be configured."""
    lan_regex = r"^https?://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$"
    settings = Settings(ALLOWED_ORIGIN_REGEX=lan_regex)
    assert settings.ALLOWED_ORIGIN_REGEX == lan_regex


def test_allowed_origin_regex_invalid_syntax():
    """Verify invalid regex pattern raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(ALLOWED_ORIGIN_REGEX="[unclosed-regex")
    assert "Invalid ALLOWED_ORIGIN_REGEX syntax" in str(exc_info.value)


def test_production_wildcard_origin_regex_rejected():
    """Verify production mode rejects wildcard match-all regex."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(ENVIRONMENT="production", ALLOWED_ORIGIN_REGEX=".*")
    assert "Security violation: ALLOWED_ORIGIN_REGEX wildcard" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        Settings(ENVIRONMENT="production", ALLOWED_ORIGIN_REGEX="^https?://.*$")
    assert "Security violation: ALLOWED_ORIGIN_REGEX wildcard" in str(exc_info.value)


def test_production_allows_strict_origin_regex():
    """Verify production allows safe specific origin regex that doesn't match arbitrary domains."""
    strict_regex = r"^https?://(192\.168\.1\.\d+)(:\d+)?$"
    settings = Settings(ENVIRONMENT="production", ALLOWED_ORIGIN_REGEX=strict_regex)
    assert settings.ALLOWED_ORIGIN_REGEX == strict_regex
