@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  npm install --no-audit --no-fund
)
node src\index.mjs serve
