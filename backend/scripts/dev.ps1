<#
.SYNOPSIS
    JetRacer Control Center Backend Developer Tooling Script
.DESCRIPTION
    Provides unified tasks for launching the backend development server, running
    type checking, linting, test suites, and live WebSocket smoke checks.
.EXAMPLE
    .\scripts\dev.ps1 run
    .\scripts\dev.ps1 test
    .\scripts\dev.ps1 lint
    .\scripts\dev.ps1 smoke
#>

param (
    [Parameter(Position=0)]
    [ValidateSet("run", "test", "lint", "smoke", "format")]
    [string]$Task = "run"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir = Split-Path -Parent $ScriptDir
Set-Location $BackendDir

$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$VenvUvicorn = Join-Path $BackendDir ".venv\Scripts\uvicorn.exe"
$VenvRuff = Join-Path $BackendDir ".venv\Scripts\ruff.exe"
$VenvMypy = Join-Path $BackendDir ".venv\Scripts\mypy.exe"
$VenvPytest = Join-Path $BackendDir ".venv\Scripts\pytest.exe"

switch ($Task) {
    "run" {
        Write-Host "Starting FastAPI development server on 127.0.0.1:8000..." -ForegroundColor Cyan
        & $VenvUvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
    }
    "test" {
        Write-Host "Running pytest test suite with code coverage..." -ForegroundColor Cyan
        & $VenvPytest --cov=app --cov-report=term-missing
    }
    "lint" {
        Write-Host "Checking code style with Ruff and static types with Mypy..." -ForegroundColor Cyan
        & $VenvRuff check .
        & $VenvMypy app
    }
    "format" {
        Write-Host "Formatting backend Python code with Ruff..." -ForegroundColor Cyan
        & $VenvRuff format .
        & $VenvRuff check --fix .
    }
    "smoke" {
        Write-Host "Running live WebSocket smoke check..." -ForegroundColor Cyan
        & $VenvPython scripts\ws_smoke.py
    }
}
