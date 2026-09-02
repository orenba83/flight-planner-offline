@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:8765
python -m http.server 8765
if errorlevel 1 py -m http.server 8765
pause
