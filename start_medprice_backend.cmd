@echo off
cd /d "%~dp0backend"
title MedPrice Backend
echo Starting MedPrice on http://127.0.0.1:8000
echo Keep this window open while using the app or port forwarding.
python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
