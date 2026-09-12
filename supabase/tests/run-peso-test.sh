#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Prova da regra "um registro de peso por dia" (migration 0019) contra um
# Postgres REAL e efêmero. Mesmo formato do `run-cas-test.sh`. Exit 0 = passou.
# Uso:  bash supabase/tests/run-peso-test.sh
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../migrations"

if [ ! -x "$PGBIN/initdb" ]; then
  echo "SKIP: PostgreSQL não encontrado em $PGBIN (defina PGBIN)."; exit 78
fi

RUNUSER=""
if [ "$(id -u)" = "0" ]; then
  for u in postgres ubuntu claude; do id "$u" >/dev/null 2>&1 && RUNUSER="$u" && break; done
  [ -n "$RUNUSER" ] || { echo "SKIP: sem usuário não-root para rodar o servidor."; exit 78; }
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
runpg "$PGBIN/createdb -h '$WORK' -U postgres testpeso"

runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testpeso -f '$HERE/_prelude_auth_stub.sql'" >"$WORK/prelude.log" 2>&1
for m in 0001_init.sql 0002_rls.sql 0005_profile_email_preferencias.sql 0006_rls_hardening_allowlist.sql 0019_peso_um_por_dia.sql; do
  runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testpeso -f '$MIG/$m'" >>"$WORK/migrate.log" 2>&1
done

if runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testpeso -f '$HERE/peso_um_por_dia.sql'" 2>"$WORK/test.err"; then
  grep -h 'NOTICE' "$WORK/test.err" 2>/dev/null || true
  echo "✅ peso um-por-dia: PASSOU (Postgres real)."
  exit 0
else
  echo "❌ peso um-por-dia: FALHOU."; cat "$WORK/test.err"; exit 1
fi
