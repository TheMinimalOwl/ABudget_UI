@echo off
setlocal
set "ROOT=%~dp0.."
set "NODE=%ROOT%\.tools\node\node.exe"

if not exist "%NODE%" (
  echo No se encontro Node 22 portatil en "%NODE%".
  echo Usa un Node 22 del sistema:
  echo   node --env-file=.env %*
  exit /b 1
)

"%NODE%" --env-file="%ROOT%\.env" %*
