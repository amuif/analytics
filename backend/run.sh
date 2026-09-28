#!/usr/bin/env bash
# Shell Startup Script for Analytics FastAPI Backend
set -e

echo "=========================================================="
echo "  Starting Analytics Content Classifier (FastAPI + Laya)  "
echo "=========================================================="

export PYTHONPATH="."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
