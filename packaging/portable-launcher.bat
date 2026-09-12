@echo off
chcp 65001 >nul
title App Adaptkorpus (portatil)
set PORT=3000
set HOSTNAME=127.0.0.1
set NODE_ENV=production

echo ============================================================
echo      APP ADAPTKORPUS - versao portatil (sem instalar nada)
echo ============================================================
echo.
echo O app abre no navegador em alguns segundos:
echo     http://localhost:3000
echo.
echo Para PARAR o app: feche esta janela.
echo ------------------------------------------------------------
echo.

rem Abre o navegador assim que o servidor sobe (sem travar o terminal).
start "" /b cmd /c "timeout /t 4 /nobreak >nul & explorer http://localhost:3000"

rem Roda o app com o Node EMBUTIDO (node\node.exe) sobre o servidor standalone.
cd /d "%~dp0app"
"%~dp0node\node.exe" server.js

echo.
echo O app foi encerrado.
pause
