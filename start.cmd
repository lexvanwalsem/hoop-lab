@echo off
rem Starts Hoop Lab: installs dependencies on first run, opens the browser, starts the dev server.
cd /d "%~dp0"
if not exist node_modules call npm install
start "" http://localhost:5173
npm run dev
