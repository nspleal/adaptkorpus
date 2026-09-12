@echo off
chcp 65001 >nul
cd /d "%~dp0"
title App Adaptkorpus
echo ============================================================
echo               INICIANDO O APP ADAPTKORPUS
echo ============================================================
echo.

rem 1) Node.js instalado?
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  echo Instale o Node.js 20 ou superior em https://nodejs.org e rode de novo.
  echo.
  pause
  exit /b 1
)

rem 2) Primeira vez? Instala as dependencias.
if not exist "node_modules" (
  echo Primeira vez aqui: instalando as dependencias.
  echo Isso pode levar alguns minutos. Aguarde...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar as dependencias.
    pause
    exit /b 1
  )
)

echo.
echo ------------------------------------------------------------
echo  O app vai abrir em:   http://localhost:3000
echo  Uma aba do navegador abre sozinha em alguns segundos.
echo  (Se nao abrir, digite o endereco acima no navegador.)
echo.
echo  Para PARAR o app: feche esta janela.
echo ------------------------------------------------------------
echo.

rem 3) Abre o navegador apos o servidor subir (sem travar o terminal).
start "" /b cmd /c "timeout /t 8 /nobreak >nul & explorer http://localhost:3000"

rem 4) Sobe o app (fica rodando nesta janela).
call npm run dev

echo.
echo O app foi encerrado.
pause
