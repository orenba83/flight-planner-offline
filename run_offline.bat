@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:8765
python run_offline.py
if errorlevel 1 py run_offline.py
pause
