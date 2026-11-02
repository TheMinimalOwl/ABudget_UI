@echo off
setlocal
set "ROOT=%~dp0"
set "NODE_DIR=%ROOT%.tools\node"

if not exist "%NODE_DIR%\node.exe" (
  echo No se encontro Node 22 portatil en "%NODE_DIR%".
  echo Instala Node 22 y ejecuta: npm run build
  exit /b 1
)

set "PATH=%NODE_DIR%;%PATH%"
call "%NODE_DIR%\npm.cmd" run build
