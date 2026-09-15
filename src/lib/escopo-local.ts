'use client';

/**
 * ESCOPO DOS DADOS LOCAIS — uma chave de `localStorage` por USUÁRIO.
 *
 * 🔴 O defeito que isto fecha (auditoria 2026-07-29): `sairDaConta()` limpava só
 * `evk_sessao`. Sobreviviam treinos, pesos e aderência — e a reconciliação do Painel trata
 * dado só-local como "write perdido" e o RE-SOBE. Em navegador compartilhado: A desloga,
 * B entra, e os registros de A eram gravados nas linhas de B, com o RLS deixando (o JWT é
 * de B). O self-heal, correto para um usuário, virava o vetor com dois.
 * ✅ Verificado no banco de produção: **não chegou a acontecer** (10 linhas em `logs`,
 * nenhuma anterior à conta, nenhuma em lote). Tudo aqui é prevenção.
 *
 * Por que PREFIXAR e não só limpar no logout: limpar guarda um caminho — o do logout
 * explícito. Prefixar torna a leitura cruzada **impossível por construção**, e cobre os
 * caminhos que não passam pelo logout: aba fechada, sessão expirada, cookie limpo pelo
 * navegador. As duas coisas entram (o logout também limpa, por minimização — LGPD).
 *
 * ⚠️ As chaves LEGADAS (sem escopo) são **apagadas sem serem lidas**. Reconciliá-las É o
 * vazamento — subir dado de dono desconhecido para a conta que acabou de entrar é
 * exatamente o que se está prevenindo. Custo zero aqui: o banco não tem nenhum registro de
 * treino/peso/refeição, então não há write não sincronizado a perder.
 */

/**
 * 🔒 FONTE ÚNICA das chaves de `localStorage` do app. Um teste falha se existir
 * `localStorage.getItem/setItem('evk_…')` no código fora desta lista — foi assim que a 9ª
 * chave (`evk_privacy_ack_v1`) apareceu, depois de a lista manual de `limparDadosLocais`
 * já ter esquecido duas. Lista derivada, não redigitada.
 */
export const CHAVES_LOCAIS = [
  'evk_sessao',
  'evk_treinos',
  'evk_pesos',
  // Âncora do peso do plano (Leva D): com que peso o plano vigente foi gerado, desde quando,
  // e o estado da faixa protetiva do gate. É dado de SAÚDE derivado — entra na varredura.
  'evk_peso_plano',
  'evk_aderencia',
  'evk_aba',
  'evk_cardio_planejado_v1',
  'evk_freq_periodo',
  'evk_privacy_ack_v1',
  'evk_instalar_ack_v1',
] as const;
export type ChaveLocal = (typeof CHAVES_LOCAIS)[number];

/** Chaves de `sessionStorage` (morrem com a aba) — listadas à parte, limpas junto. */
export const CHAVES_SESSAO = ['evk_email'] as const;

/**
 * 🔒 CHAVES APOSENTADAS — a feature saiu do app, mas o dado **continua no navegador de quem
 * já usou**. Elas nunca são lidas nem escritas: só **apagadas**.
 *
 * `evk_notif` (aposentada em 2026-07-29): o cartão de notificações era fachada — nada
 * consumia a preferência —, então saiu inteiro. Sem esta lista a chave sairia de
 * `CHAVES_LOCAIS` e `limparDadoPessoalLocal` **pararia de varrê-la**: a preferência de quem
 * clicou "Ativar" ficaria em repouso no navegador para sempre, inclusive depois do logout e
 * da exclusão de conta. Minimização (LGPD) não admite dado órfão que a gente esqueceu de
 * apagar porque removeu a tela.
 *
 * ⚠️ Nunca reintroduza uma chave daqui em `CHAVES_LOCAIS` sem antes conferir se o formato
 * antigo do valor ainda é legível — na dúvida, use um nome novo.
 */
export const CHAVES_APOSENTADAS = ['evk_notif'] as const;

/**
 * Chaves que NÃO recebem escopo: são do dispositivo, não da pessoa, e re-perguntar o aviso
 * de privacidade a cada troca de conta no mesmo navegador seria ruído sem ganho de
 * privacidade (o valor é um `'1'`, não contém dado nenhum).
 */
const SEM_ESCOPO: ReadonlySet<string> = new Set<ChaveLocal>([
  'evk_privacy_ack_v1',
  // O convite de instalação é do DISPOSITIVO: instalar é ato do aparelho, não da conta.
  // Re-convidar a cada troca de usuário no mesmo celular seria insistência sem ganho — e o
  // valor é um `'1'`, sem dado nenhum.
  'evk_instalar_ack_v1',
]);

/**
 * Chaves com DADO PESSOAL — as que o logout precisa apagar e o escopo precisa isolar.
 * As aposentadas entram: não se lê nenhuma delas, mas todas se apagam.
 */
const COM_DADO_PESSOAL: readonly string[] = [
  ...CHAVES_LOCAIS.filter((k) => !SEM_ESCOPO.has(k)),
  ...CHAVES_APOSENTADAS,
];

let escopo: string | null = null;

/**
 * Define de quem são os dados locais desta aba. Chamado no boot da área logada, com o
 * `user.id`; e com `null` no logout.
 *
 * Ao entrar num escopo REAL, as chaves legadas (sem sufixo) são **descartadas sem leitura**
 * — ver o ⚠️ do topo. Retorna quantas apagou (o chamador não usa; serve ao teste).
 */
export function definirEscopoLocal(userId: string | null): number {
  escopo = userId && userId.length > 0 ? userId : null;
  if (!escopo) return 0;
  return descartarLegado();
}

/** Escopo ativo (`null` = modo mock / deslogado, que usa as chaves sem sufixo). */
export function escopoLocal(): string | null {
  return escopo;
}

/** A chave real no `localStorage`: `evk_treinos:<user.id>` quando há escopo. */
export function chaveLocal(base: ChaveLocal): string {
  if (!escopo || SEM_ESCOPO.has(base)) return base;
  return `${base}:${escopo}`;
}

/**
 * Apaga as chaves legadas (sem sufixo) que carregam dado pessoal. **Sem ler.** Rodado ao
 * entrar num escopo real: são dados de dono desconhecido, e o único uso seguro é o descarte.
 */
function descartarLegado(): number {
  if (typeof window === 'undefined') return 0;
  let n = 0;
  for (const k of COM_DADO_PESSOAL) {
    try {
      if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); n += 1; }
    } catch { /* storage indisponível */ }
  }
  return n;
}

/**
 * Apaga TODO dado pessoal local: do escopo atual, do legado sem sufixo e de QUALQUER outro
 * escopo presente no navegador. Usado no logout (minimização) e na exclusão de conta.
 *
 * A varredura por prefixo é o que cobre o caso "outra conta usou este navegador antes de o
 * escopo existir" — sem ela, o dado de terceiros ficaria em repouso para sempre.
 */
export function limparDadoPessoalLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    const alvos: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k) continue;
      const base = k.includes(':') ? k.slice(0, k.indexOf(':')) : k;
      if ((COM_DADO_PESSOAL as readonly string[]).includes(base)) alvos.push(k);
    }
    for (const k of alvos) localStorage.removeItem(k);
  } catch { /* storage indisponível */ }
  try {
    for (const k of CHAVES_SESSAO) sessionStorage.removeItem(k);
  } catch { /* storage indisponível */ }
}

/**
 * Resolve o escopo a partir da sessão do Supabase e o define. Chamado nos pontos de ENTRADA
 * do cliente que LEEM dado local — hoje `/app` e `/onboarding` — **antes** de qualquer
 * leitura. Os testes de ordem no fim de `escopo-local.test.ts` travam esses dois.
 *
 * ⚠️ `/conta` NÃO chama, e está correto: ela não lê nenhuma chave com escopo (nome e e-mail
 * vêm do `auth`), e o `limparDadosLocais()` da exclusão de conta varre **por prefixo**, em
 * todos os escopos — não depende de escopo resolvido. Este comentário já afirmou que
 * `/conta` chamava; não chamava, e a lista errada num arquivo que é a fonte única sobre
 * escopo é pior que a ausência da chamada.
 *
 * Sem Supabase (modo mock) o escopo fica `null` de propósito: as chaves sem sufixo seguem
 * sendo as de trabalho, e o modo mock não tem persistência de servidor — não há para onde
 * vazar. Usa `getSession()` (síncrona ao storage, sem rede): aqui não se decide segurança,
 * só de quem é a gaveta; quem valida o JWT é o servidor, a cada request.
 */
export async function resolverEscopoLocal(): Promise<string | null> {
  const { supabaseConfigurado } = await import('@/lib/supabase/env');
  if (!supabaseConfigurado()) { definirEscopoLocal(null); return null; }
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const { data: { session } } = await createClient().auth.getSession();
    const id = session?.user?.id ?? null;
    definirEscopoLocal(id);
    return id;
  } catch {
    definirEscopoLocal(null);
    return null;
  }
}
