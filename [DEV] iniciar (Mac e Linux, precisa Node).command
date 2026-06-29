#!/bin/bash
# Lançador do App Evokorpus para Mac e Linux.
# No Mac: dê duplo-clique. (Se pedir permissão: botão direito > Abrir.)
cd "$(dirname "$0")" || exit 1

echo "============================================================"
echo "              INICIANDO O APP EVOKORPUS"
echo "============================================================"
echo

# 1) Node.js instalado?
if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js nao encontrado."
  echo "Instale o Node.js 20 ou superior em https://nodejs.org e rode de novo."
  read -r -p "Pressione Enter para sair..."
  exit 1
fi

# 2) Primeira vez? Instala as dependencias.
if [ ! -d node_modules ]; then
  echo "Primeira vez aqui: instalando as dependencias (pode levar alguns minutos)..."
  echo
  if ! npm install; then
    echo
    echo "[ERRO] Falha ao instalar as dependencias."
    read -r -p "Pressione Enter para sair..."
    exit 1
  fi
fi

echo
echo "------------------------------------------------------------"
echo " O app vai abrir em:   http://localhost:3000"
echo " Uma aba do navegador abre sozinha em alguns segundos."
echo " (Se nao abrir, digite o endereco acima no navegador.)"
echo
echo " Para PARAR o app: feche esta janela ou pressione Ctrl+C."
echo "------------------------------------------------------------"
echo

# 3) Abre o navegador depois que o servidor sobe (sem travar o terminal).
( sleep 8; (open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null) ) &

# 4) Sobe o app (fica rodando nesta janela).
npm run dev
