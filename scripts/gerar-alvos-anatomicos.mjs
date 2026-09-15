/**
 * 🦴 GERA a classificação ANATÔMICA PRÁTICA dos 168 ids a partir do pacote externo
 * `mapa-consumo-motor-168-20260915` (MAPA-MOTOR.json, schema `adaptkorpus.alvos-operacionais.v1`).
 *
 * Escreve DOIS módulos, e a divisão não é estética:
 *  · `src/lib/data/alvos-anatomicos-dados.ts` — o que o MOTOR lê (alvos, papéis, condicionais
 *    e DESCRITORES). Vai no bundle do cliente, porque o motor roda no browser: fica só o
 *    necessário para decidir cobertura anatômica e complementaridade mecânica;
 *  · `src/lib/data/alvos-anatomicos-fontes.ts` — o que a TELA lê sob demanda (fontes, regras
 *    com justificativa, ênfases contextuais, limites de discriminação). Servido por
 *    `/api/catalogo/alvos-anatomicos`; nunca entra no caminho de decisão.
 *
 * 🔴 O que NÃO é portado, de propósito:
 *  · `evidenciaOrigemIds` (1.706 relações de ORIGEM-CP02.json) — o RELATORIO.md do pacote diz
 *    com todas as letras que são **contexto científico, não atalho para cobertura**. Copiá-las
 *    para dentro do app as transformaria num array pronto para o seletor, que é exatamente o
 *    uso proibido. Quem precisar auditar vai ao pacote, que guarda os estados e as citações;
 *  · `preferenciaRegionalComprovada` — vazio em todos os 168 nesta camada. Um campo vazio
 *    viajaria como se fosse um lugar a preencher com peso; não é.
 *
 * 🔒 Determinismo: percorre os ids na ordem do pacote, não usa relógio nem aleatório, e é
 * IDEMPOTENTE — rodar de novo com o mesmo pacote reescreve os mesmos bytes. O SHA-256 do
 * MAPA-MOTOR.json entra nos dados como proveniência (`PROCEDENCIA_ANATOMICA`), e o teste
 * `alvos-anatomicos.test.ts` confere contagens contra CONTAGENS.json do pacote.
 *
 * Uso: node scripts/gerar-alvos-anatomicos.mjs [--pacote <dir>] [--check]
 *   --pacote  raiz do pacote externo (padrão: PACOTE_PADRAO abaixo)
 *   --check   não escreve; falha (exit 1) se o gerado divergir do que está em disco.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Onde o pacote da entrega de 2026-09-15 vive na máquina do autor. Proveniência, não dependência
 *  de runtime: nada no app abre este caminho — o gerador o lê uma vez e escreve TypeScript. */
const PACOTE_PADRAO = 'C:/Users/Administrador/Desktop/segundo cerebro/evidencias/mapa-consumo-motor-168-20260915';

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const iPacote = argv.indexOf('--pacote');
const PACOTE = iPacote >= 0 ? argv[iPacote + 1] : PACOTE_PADRAO;

const DESTINO_DADOS = new URL('../src/lib/data/alvos-anatomicos-dados.ts', import.meta.url);
const DESTINO_FONTES = new URL('../src/lib/data/alvos-anatomicos-fontes.ts', import.meta.url);

const bytesMapa = readFileSync(join(PACOTE, 'MAPA-MOTOR.json'));
const sha256Mapa = createHash('sha256').update(bytesMapa).digest('hex');
const mapa = JSON.parse(bytesMapa.toString('utf8'));
const contagens = JSON.parse(readFileSync(join(PACOTE, 'CONTAGENS.json'), 'utf8'));
const verificacao = JSON.parse(readFileSync(join(PACOTE, 'VERIFICACAO.json'), 'utf8'));

if (mapa.schema !== 'adaptkorpus.alvos-operacionais.v1') {
  throw new Error(`schema inesperado: ${mapa.schema}`);
}

// ── Serialização estável ────────────────────────────────────────────────────
/** JSON com aspas duplas, chaves na ordem dada e sem depender da ordem de inserção do V8. */
const j = (v) => JSON.stringify(v);
const linhasDe = (pares) => pares.map(([k, v]) => `  ${j(k)}: ${v},`).join('\n');

// ── Vocabulário de condições (derivado, não inventado) ──────────────────────
// As chaves e os valores são os que o pacote declarou em `condicionais[].quando`. A união
// literal existe para o TypeScript recusar `{ movimento: 'qualquer' }` em tempo de compilação,
// como `consulta.py` recusa em tempo de execução.
const vocabulario = new Map();
for (const e of mapa.exercicios) {
  for (const c of e.condicionais) {
    for (const [k, v] of Object.entries(c.quando)) {
      if (!vocabulario.has(k)) vocabulario.set(k, new Set());
      vocabulario.get(k).add(typeof v === 'boolean' ? String(v) : j(v));
    }
  }
}
// 🔒 `consulta.py` aceita `retroversaoPelvica: false` mesmo sem ele aparecer em nenhum `quando`:
// declarar que NÃO houve retroversão é informação de execução, e a condição resolve negativa.
// Só o booleano ganha o par: as chaves de string não têm valor "nenhum" declarado no pacote.
for (const [k, vals] of vocabulario) {
  if ([...vals].every((v) => v === 'true' || v === 'false')) { vals.add('true'); vals.add('false'); }
  void k;
}
const chavesCondicao = [...vocabulario.keys()].sort();

// ── Módulo do MOTOR ─────────────────────────────────────────────────────────
const alvosIds = Object.keys(mapa.alvos);
const alvosLinhas = linhasDe(alvosIds.map((id) => {
  const a = mapa.alvos[id];
  return [id, `{ nome: ${j(a.nome)}, grupo: ${j(a.grupo)}, musculo: ${j(a.musculo)}, parte: ${j(a.parte)}, tipo: ${j(a.tipo)} }`];
}));

const gruposDeAlvo = [...new Set(alvosIds.map((id) => mapa.alvos[id].grupo))].sort();
const tiposDeAlvo = [...new Set(alvosIds.map((id) => mapa.alvos[id].tipo))].sort();

const exerciciosLinhas = linhasDe(mapa.exercicios.map((e) => {
  const alvos = e.alvos.map((a) => `[${j(a.alvo)}, ${j(a.papel)}]`).join(', ');
  const condicionais = e.condicionais
    .map((c) => `{ quando: ${j(c.quando)}, alvos: [${c.alvos.map(j).join(', ')}], papel: ${j(c.papel)} }`)
    .join(', ');
  const descritores = Object.keys(e.descritores).length > 0 ? `, descritores: ${j(e.descritores)}` : '';
  return [e.id, `{ regra: ${j(e.regra)}, uso: ${j(e.uso)}, alvos: [${alvos}], condicionais: [${condicionais}]${descritores} }`];
}));

const dados = `/**
 * 🦴 GERADO por \`scripts/gerar-alvos-anatomicos.mjs\` — NÃO editar à mão.
 *
 * Fonte: pacote externo \`mapa-consumo-motor-168-20260915\`, MAPA-MOTOR.json
 * (schema \`${mapa.schema}\`, SHA-256 em \`PROCEDENCIA_ANATOMICA\`).
 *
 * 🔒 Este é o lado do MOTOR: alvo, papel e condição. É o mínimo para decidir cobertura, e o
 * único arquivo desta integração que entra no bundle do cliente. Fontes, justificativas,
 * ênfases e limites vivem em \`alvos-anatomicos-fontes.ts\` e são servidos sob demanda — nada
 * disso participa de decisão.
 *
 * 🔴 \`direto\` é classificação FUNCIONAL pela tarefa (inferência anatômica explícita): não é
 * maior EMG, não é exclusividade e não é garantia de dose suficiente. \`auxiliar\` não fecha
 * cobertura direta. \`informativo_cardio\` não vira série de hipertrofia.
 */
import type { AlvoAnatomico, ExercicioAnatomico } from './alvos-anatomicos-tipos';

/** Proveniência da rodada — o que foi lido, e o estado que o pacote declarou para si. */
export const PROCEDENCIA_ANATOMICA = {
  schema: ${j(mapa.schema)},
  estado: ${j(mapa.estado)},
  definicaoDeAlvoDireto: ${j(mapa.definicao)},
  pacote: 'mapa-consumo-motor-168-20260915',
  arquivo: 'MAPA-MOTOR.json',
  sha256: ${j(sha256Mapa)},
  ids: ${contagens.ids},
  alvos: ${contagens.alvos},
  regras: ${contagens.regras},
  idsCardio: ${contagens.idsCardio},
  idsComCondicoes: [${contagens.idsComCondicoes.map(j).join(', ')}],
  idsComEnfaseContextual: [${contagens.idsComEnfaseContextual.map(j).join(', ')}],
  /** 🔴 Preservadas NO PACOTE como contexto científico; deliberadamente fora deste módulo. */
  relacoesOriginaisNoPacote: ${contagens.relacoesOriginaisPreservadas},
  preferenciasRegionaisUniversaisCertificadas: ${contagens.preferenciasRegionaisUniversaisCertificadasNestaLeva},
  limiteDaVerificacao: ${j(verificacao.limite)},
} as const;

/** Grupos que os 44 alvos declaram. 🔴 NÃO são os 12 \`GrupoPrimario\` do catálogo: três deles
 *  (${gruposDeAlvo.filter((g) => !['antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar', 'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps'].includes(g)).map((g) => `\`${g}\``).join(', ')})
 *  não existem como grupo do app e nunca viram obrigação de dia. */
export const GRUPOS_DE_ALVO = [${gruposDeAlvo.map(j).join(', ')}] as const;

/** Níveis anatômicos distintos — cabeça, porção, músculo, grupo e região NÃO são subdivisões
 *  equivalentes e não podem ser contados como se fossem. */
export const TIPOS_DE_ALVO = [${tiposDeAlvo.map(j).join(', ')}] as const;

/** Vocabulário FECHADO das condições de execução, derivado de \`condicionais[].quando\`. */
export const VOCABULARIO_CONDICAO = {
${chavesCondicao.map((k) => `  ${k}: [${[...vocabulario.get(k)].sort().join(', ')}],`).join('\n')}
} as const;

/** Os 44 alvos. Chave estável; o nome é o do pacote. */
export const ALVOS_ANATOMICOS: Readonly<Record<string, AlvoAnatomico>> = {
${alvosLinhas}
};

/**
 * Os 168 ids. \`alvos\` é [alvo, papel]; \`condicionais\` só resolve com execução declarada.
 *
 * 🔴 \`descritores\` está aqui — e não só no módulo da tela — porque a COMPLEMENTARIDADE
 * MECÂNICA da seleção automática os lê (inclinação, pegada, posição do ombro, do quadril e do
 * joelho, trajetória, apoio). São 42 dos 168 ids; os outros não declaram nenhum, e ausência de
 * descritor NÃO é ausência de característica: é ausência de declaração no catálogo.
 * Continuam sendo DESCRITORES: explicam diferença de tarefa, não medem eficiência.
 */
export const ANATOMIA_POR_EXERCICIO: Readonly<Record<string, ExercicioAnatomico>> = {
${exerciciosLinhas}
};
`;

// ── Módulo da TELA ──────────────────────────────────────────────────────────
const fontesLinhas = linhasDe(Object.entries(mapa.fontes).map(([k, f]) => [k, j(f)]));
const regrasLinhas = linhasDe(Object.entries(mapa.regras).map(([k, r]) => [k, j({
  acao: r.acao, natureza: r.natureza, justificativa: r.justificativa, fontes: r.fontes,
})]));
// 🔴 Sem \`descritores\`: eles vivem no módulo do motor (a tela os lê de lá pela rota), e
// duplicá-los criaria duas verdades para o mesmo campo.
const detalheLinhas = linhasDe(mapa.exercicios.map((e) => [e.id, j({
  nome: e.nome,
  grupoCatalogo: e.grupoCatalogo,
  descricaoAcao: e.descricaoAcao,
  enfasesContextuais: e.enfasesContextuais,
  limitacao: e.limitacao,
})]));

const fontes = `/**
 * 🦴 GERADO por \`scripts/gerar-alvos-anatomicos.mjs\` — NÃO editar à mão.
 *
 * O lado da TELA: fontes, regras com justificativa, descritores, ênfases contextuais e os
 * limites de discriminação. Servido por \`/api/catalogo/alvos-anatomicos\`; **nenhuma decisão
 * do motor lê este arquivo** — por isso ele pode crescer sem pesar no caminho de geração.
 *
 * 🔴 \`enfasesContextuais\` carrega o protocolo, o comparador e o limite da
 * comparação de Cabral 2022: distribuição espacial de EMG sob barra a 0° vs 45°, 50–70% 1RM.
 * Não é prova de hipertrofia, não vale para halteres e \`usarComoPesoAutomatico\` é \`false\`.
 */
import type { DetalheAnatomico, FonteAnatomica, LimiteDeDiscriminacao, RegraAnatomica } from './alvos-anatomicos-tipos';

/** As ${Object.keys(mapa.fontes).length} fichas de fonte operacional citadas pelas regras. */
export const FONTES_ANATOMICAS: Readonly<Record<string, FonteAnatomica>> = {
${fontesLinhas}
};

/** As ${Object.keys(mapa.regras).length} regras: a ação que classifica, a natureza e as fontes. */
export const REGRAS_ANATOMICAS: Readonly<Record<string, RegraAnatomica>> = {
${regrasLinhas}
};

/** Descritores, ênfases e limitação POR id — o que a tela mostra ao lado do "como fazer". */
export const DETALHE_ANATOMICO: Readonly<Record<string, DetalheAnatomico>> = {
${detalheLinhas}
};

/**
 * 🔴 O que a pesquisa NÃO permite distinguir. São resultados explícitos, não lacunas a
 * preencher depois: promover qualquer um deles a região validada seria inventar cobertura.
 */
export const LIMITES_DE_DISCRIMINACAO: readonly LimiteDeDiscriminacao[] = ${JSON.stringify(mapa.limitesDeDiscriminacao, null, 2)};
`;

function entregar(url, conteudo, rotulo) {
  if (!CHECK) { writeFileSync(url, conteudo, 'utf8'); console.log(`escrito: ${rotulo} (${conteudo.length} bytes)`); return true; }
  let atual = '';
  try { atual = readFileSync(url, 'utf8'); } catch { /* ausente conta como divergente */ }
  const igual = atual === conteudo;
  console.log(`${igual ? 'ok' : 'DIVERGENTE'}: ${rotulo}`);
  return igual;
}

const okDados = entregar(DESTINO_DADOS, dados, 'alvos-anatomicos-dados.ts');
const okFontes = entregar(DESTINO_FONTES, fontes, 'alvos-anatomicos-fontes.ts');
if (CHECK && !(okDados && okFontes)) process.exit(1);
