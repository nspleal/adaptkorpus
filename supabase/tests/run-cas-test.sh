#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# C1 · CAS — roda o teste de atomicidade contra um Postgres REAL, efêmero (local).
# Decisão do autor "CAS PERSISTENTE": o CAS deve ser testado contra Supabase real/local,
# não só in-memory. Este runner sobe um Postgres 16 descartável, aplica a migração 0015 e
# roda o CAS histórico e a persistência C1.1-C (asserts plpgsql). Exit 0 = tudo passou.
#
# Uso:  bash supabase/tests/run-cas-test.sh
# Requer: binários do PostgreSQL (initdb/postgres/psql) e um usuário não-root para o servidor.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATION_CAS="$HERE/../migrations/0015_c1_cas_metadata.sql"
MIGRATION_ATOMICA="$HERE/../migrations/0016_c1_persistencia_atomica.sql"
MIGRATION_SINCRONIZACAO="$HERE/../migrations/0017_c1_sincronizacao_plano_realtime.sql"
TESTSQL="$HERE/cas_atomicidade.sql"
TEST_ATOMICO="$HERE/cas_persistencia_atomica.sql"
TEST_SINCRONIZACAO="$HERE/cas_sincronizacao_realtime.sql"

if [ ! -x "$PGBIN/initdb" ]; then
  # SKIP não é aprovação: C1.1-C exige esta prova no Postgres real antes de encerrar.
  echo "SKIP: PostgreSQL não encontrado em $PGBIN (defina PGBIN)."; exit 78
fi

# Postgres recusa rodar como root; usa um usuário de sistema não-privilegiado.
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
runpg "$PGBIN/createdb -h '$WORK' -U postgres testcas"

# Aplica o esquema necessário, o CAS legado, depois a evolução C1.1-C e seus testes.
runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$HERE/_prelude_auth_stub.sql'" >"$WORK/prelude.log" 2>&1
for migration in 0001_init.sql 0002_rls.sql 0005_profile_email_preferencias.sql 0006_rls_hardening_allowlist.sql; do
  runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$HERE/../migrations/$migration'" >>"$WORK/migrate.log" 2>&1
done
runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$MIGRATION_CAS'" >>"$WORK/migrate.log" 2>&1
runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$TESTSQL'" >>"$WORK/test.err" 2>&1
runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$MIGRATION_ATOMICA'" >>"$WORK/migrate.log" 2>&1
runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$MIGRATION_SINCRONIZACAO'" >>"$WORK/migrate.log" 2>&1
if runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$TEST_ATOMICO'" 2>"$WORK/test.err" \
  && runpg "psql -v ON_ERROR_STOP=1 -h '$WORK' -U postgres -d testcas -f '$TEST_SINCRONIZACAO'" 2>>"$WORK/test.err"; then
  grep -h 'NOTICE' "$WORK/test.err" 2>/dev/null || true
  echo "✅ CAS atomicidade e sincronização: PASSARAM (Postgres real)."
  exit 0
else
  echo "❌ CAS atomicidade/sincronização: FALHOU."; cat "$WORK/test.err"; exit 1
fi
