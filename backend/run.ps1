# PowerShell Startup Script for Analytics FastAPI Backend
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting Analytics Content Classifier (FastAPI + Laya)  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$env:PYTHONPATH = "."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
