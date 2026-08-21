#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# C1 · CAS — roda o teste de atomicidade contra um Postgres REAL, efêmero (local).
# Decisão do autor "CAS PERSISTENTE": o CAS deve ser testado contra Supabase real/local,
# não só in-memory. Este runner sobe um Postgres 16 descartável, aplica a migração 0015 e
# roda `cas_atomicidade.sql` (asserts plpgsql). Exit 0 = tudo passou.
#
# Uso:  bash supabase/tests/run-cas-test.sh
# Requer: binários do PostgreSQL (initdb/postgres/psql) e um usuário não-root para o servidor.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATION="$HERE/../migrations/0015_c1_cas_metadata.sql"
TESTSQL="$HERE/cas_atomicidade.sql"

if [ ! -x "$PGBIN/initdb" ]; then
  echo "SKIP: PostgreSQL não encontrado em $PGBIN (defina PGBIN)."; exit 0
fi

# Postgres recusa rodar como root; usa um usuário de sistema não-privilegiado.
RUNUSER=""
if [ "$(id -u)" = "0" ]; then
  for u in postgres ubuntu claude; do id "$u" >/dev/null 2>&1 && RUNUSER="$u" && break; done
  [ -n "$RUNUSER" ] || { echo "SKIP: sem usuário não-root para rodar o servidor."; exit 0; }
fi

WORK="$(mktemp -d)"
[ -n "$RUNUSER" ] && chown -R "$RUNUSER" "$WORK"

runpg() { if [ -n "$RUNUSER" ]; then su "$RUNUSER" -s /bin/bash -c "$1"; else bash -c "$1"; fi; }

cleanup() {
  runpg "$PGBIN/pg_ctl -D '$WORK/data' stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

runpg "$PGBIN/initdb -D '$WORK/data' -U postgres --auth=trust" >"$WORK/initdb.log" 2>&1
runpg "$PGBIN/pg_ctl -D '$WORK/data' -o '-k $WORK -c listen_addresses=' -l '$WORK/pg.log' -w start" >/dev/null 2>&1
runpg "$PGBIN/createdb -h '$WORK' -U postgres testcas"

# Aplica o prelúdio (stub auth), a migração real e depois o teste (mesmo banco).
runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$HERE/_prelude_auth_stub.sql'" >"$WORK/prelude.log" 2>&1
runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$MIGRATION'" >"$WORK/migrate.log" 2>&1
if runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$TESTSQL'" 2>"$WORK/test.err"; then
  grep -h 'NOTICE' "$WORK/test.err" 2>/dev/null || true
  echo "✅ CAS atomicidade: PASSOU (Postgres real)."
  exit 0
else
  echo "❌ CAS atomicidade: FALHOU."; cat "$WORK/test.err"; exit 1
fi
