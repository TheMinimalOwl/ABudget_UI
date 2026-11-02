@echo off
setlocal
set "ROOT=%~dp0.."
set "NODE=%ROOT%\.tools\node\node.exe"

if not exist "%NODE%" (
  echo No se encontro Node portatil en "%NODE%".
  echo Descarga Node 22 en .tools o ejecuta con un Node 22 del sistema:
  echo   node --env-file=.env scripts\spike.mjs
  exit /b 1
)

"%NODE%" --env-file="%ROOT%\.env" "%ROOT%\scripts\spike.mjs" %*
