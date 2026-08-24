#!/usr/bin/env node
/**
 * 🔒 C1 §8.4 — RUNNER DE MUTAÇÃO REPRODUTÍVEL.
 *
 * Para cada mutação normativa e cada variante anti-regressão, aplica o patch no código-fonte,
 * roda o teste (ou testes) que DEVE matá-la e verifica que ele FALHA. Depois restaura o arquivo.
 * Um mutante que SOBREVIVE é uma lacuna real de cobertura e sai marcado como SOBREVIVEU.
 *
 * Uso:  node scripts/mutantes-c1.mjs            (todas)
 *       node scripts/mutantes-c1.mjs 3 7 12     (só as listadas)
 *       node scripts/mutantes-c1.mjs --md       (saída em tabela markdown)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = process.cwd();
const E = 'src/lib/engine';
const P = 'src/lib/persistencia';

/**
 * Cada mutação: { n, desc, alvo, de, para, testes }
 *  - `alvo`/`de`/`para`: patch textual exato (string única no arquivo);
 *  - `testes`: caminhos passados ao vitest; espera-se FALHA após o patch.
 *  - `natureza: 'ESTRUTURAL'` = a mutação não é um patch textual local (ex.: exige remover uma
 *    arquitetura inteira); nesse caso o patch aplicado é o mais próximo possível e o teste
 *    correspondente é o gate estático/arquitetural.
 */
const MUTACOES = [
  { n: 1, desc: 'restaurar fallback `1 série / 90 s`', alvo: `${E}/duracao-plano.ts`,
    de: `      faltou.push(\`slot \${i} (\${s.exercicio.id}): \${s.series == null ? 'séries' : 'descanso'} ausente\`);\n      return;`,
    para: `      s = { ...s, series: s.series ?? 1, descansoSeg: s.descansoSeg ?? 90 };`,
    testes: [`${E}/duracao-plano.test.ts`] },

  { n: 2, desc: 'voltar a usar `40 s` para isometria', alvo: `${E}/duracao-sessao.ts`,
    de: `  const h = it.execucao.holdSegundosPorSerie;`,
    para: `  const h = TEMPO_EXECUCAO_SERIE_REPS_SEG;`,
    testes: [`${E}/duracao-sessao.test.ts`] },

  { n: 3, desc: 'aceitar tempo por série do item `REPETICOES` em vez da constante única', alvo: `${E}/duracao-plano.ts`,
    de: `      execucao = { tipo: 'REPETICOES', segundosEstimadosPorSerie: TEMPO_EXECUCAO_SERIE_REPS_SEG };`,
    para: `      execucao = { tipo: 'REPETICOES', segundosEstimadosPorSerie: (s as { segPorSerie?: number }).segPorSerie ?? TEMPO_EXECUCAO_SERIE_REPS_SEG };`,
    testes: [`${E}/duracao-plano.test.ts`, `${E}/c1-mutacoes-guard.test.ts`] },

  { n: 4, desc: 'contar descanso após a última série', alvo: `${E}/duracao-sessao.ts`,
    de: `        descansoSegundos += Math.max(it.series - 1, 0) * it.descansoEntreSeriesSeg;`,
    para: `        descansoSegundos += it.series * it.descansoEntreSeriesSeg;`,
    testes: [`${E}/duracao-sessao.test.ts`, `${E}/duracao-golden.test.ts`] },

  { n: 5, desc: 'ignorar unilateralidade', alvo: `${E}/duracao-sessao.ts`,
    de: `  const fator = it.unilateralDoisLados === true ? 2 : 1;`,
    para: `  const fator = 1;`,
    testes: [`${E}/duracao-sessao.test.ts`, `src/lib/data/lateralidade.test.ts`] },

  { n: 6, desc: 'aceitar duração negativa ou cardio em posição não final', alvo: `${E}/duracao-sessao.ts`,
    de: `      if (!ehUltimo) {\n        motivos.push(\`item \${i}: cardio/contínuo em posição não final (CARDIO_NAO_FINAL)\`);\n      } else if (!intSeguro(it.duracaoTotalSegundos) || !(it.duracaoTotalSegundos > 0)) {`,
    para: `      if (false) {\n        motivos.push('nunca');\n      } else if (false) {`,
    testes: [`${E}/duracao-sessao.test.ts`] },

  { n: 7, desc: 'aceitar segundo fracionário, infinito ou total derivado inseguro', alvo: `${E}/duracao-sessao.ts`,
    de: `const intSeguro = (n: number): boolean => Number.isSafeInteger(n);`,
    para: `const intSeguro = (n: number): boolean => typeof n === 'number';`,
    testes: [`${E}/duracao-sessao.test.ts`] },

  { n: 8, desc: 'somar aquecimento ou deslocamento até o cardio final', alvo: `${E}/duracao-sessao.ts`,
    de: `  const min = minResistida + continuoSegundos;`,
    para: `  const min = minResistida + continuoSegundos + (entrada.aquecimentoSegundos ?? 0);`,
    testes: [`${E}/aquecimento-excluido.test.ts`] },

  { n: 9, desc: 'ler reserva persistida em vez de derivar do descanso vigente', alvo: `${E}/duracao-sessao.ts`,
    de: `      if (!ehUltimo && itens[i + 1]!.tipo === 'RESISTIDO' && it.descansoEntreSeriesSeg >= 0) {\n        transicaoSegundos += it.descansoEntreSeriesSeg;`,
    para: `      if (!ehUltimo && itens[i + 1]!.tipo === 'RESISTIDO' && it.descansoEntreSeriesSeg >= 0) {\n        transicaoSegundos += (it as { reservaPersistida?: number }).reservaPersistida ?? 120;`,
    testes: [`${E}/duracao-sessao.test.ts`, `${E}/duracao-golden.test.ts`] },

  { n: 10, desc: 'multiplicar o adicional técnico derivado por séries ou lados', alvo: `${E}/duracao-sessao.ts`,
    de: `  return tec.aplicacoes.reduce((s, a) => s + a.adicionalSegundos, 0);`,
    para: `  return tec.aplicacoes.reduce((s, a) => s + a.adicionalSegundos, 0) * 3;`,
    testes: [`${E}/duracao-sessao.test.ts`] },

  { n: 11, desc: 'aceitar aplicação técnica negativa/duplicada/extra/sem correspondência', alvo: `${E}/duracao-sessao.ts`,
    de: `  if (contratoKeys.length !== matKeys.length || contratoKeys.some((k, i) => k !== matKeys[i])) {`,
    para: `  if (false) {`,
    testes: [`${E}/duracao-sessao.test.ts`] },

  { n: 12, desc: 'tratar `CONTRATO_AUSENTE` como `SEM_TECNICA`', alvo: `${E}/duracao-sessao.ts`,
    de: `  if (tec.tipo === 'CONTRATO_AUSENTE') { motivos.push(\`item \${idx}: CONTRATO_AUSENTE\`); return null; }`,
    para: `  if (tec.tipo === 'CONTRATO_AUSENTE') { return 0; }`,
    testes: [`${E}/duracao-sessao.test.ts`] },

  { n: 13, desc: 'aceitar técnica materializada sem aplicação temporal correspondente', alvo: `${E}/duracao-sessao.ts`,
    de: `    if (mat.length > 0) { motivos.push(\`item \${idx}: SEM_TECNICA com técnica materializada\`); return null; }`,
    para: `    return 0;`,
    testes: [`${E}/duracao-sessao.test.ts`] },

  { n: 14, desc: 'bloquear a entrega automática / reduzir só por `NAO_AVALIADO`', alvo: `${E}/treino-montador.ts`,
    de: `      if (resultados.some((d) => d.estadoCalculo === 'NAO_AVALIADO')) return { tipo: 'NAO_AVALIADO', resultado: resultados };`,
    para: `      if (false) return { tipo: 'NAO_AVALIADO', resultado: resultados };`,
    testes: [`src/lib/c1-caminho-publico.test.ts`] },

  { n: 15, desc: 'continuar reduzindo/declarar incompatibilidade quando a realocação der `NAO_AVALIADO`', alvo: `${E}/geracao-temporal.ts`,
    de: `      if (tentativa.tipo === 'NAO_AVALIADO') {`,
    para: `      if (false) {`,
    testes: [`${E}/geracao-temporal.test.ts`] },

  { n: 16, desc: 'usar a duração resistida publicada como verdade final', alvo: `${E}/treino-montador.ts`,
    de: `      const duracao = avaliarDuracaoFinalDoDia(
        treino?.slots ?? [], perfil.nivelExperiencia, orcamentoSeg, bloco?.duracaoTotalSegundos ?? 0,
        cardioSemDuracao,
      );`,
    para: `      const duracao = r.duracaoResistidaDias?.[ordemNoHorizonte] ?? avaliarDuracaoFinalDoDia(
        treino?.slots ?? [], perfil.nivelExperiencia, orcamentoSeg, bloco?.duracaoTotalSegundos ?? 0,
        cardioSemDuracao,
      );`,
    testes: [`src/lib/c1-caminho-publico.test.ts`, `${E}/convergencia-c1.test.ts`] },

  { n: '17a', desc: 'ignorar o recheck depois da redução de slots (montador vivo: tentativa reduzida não é reavaliada)', alvo: `${E}/treino-montador.ts`,
    de: `      const excede = precisaReduzir(plano, perfil.nivelExperiencia, orcamentoSeg);`,
    para: `      const excede = capacidade === budgetPorDia ? precisaReduzir(plano, perfil.nivelExperiencia, orcamentoSeg) : false;`,
    testes: [`src/lib/c1-caminho-publico.test.ts`] },

  { n: '17b', desc: 'ignorar o recheck depois da redução de slots (orquestrador puro: adota sem reavaliar)', alvo: `${E}/geracao-temporal.ts`,
    de: `      if (tentativa.tipo === 'CERTIFICADO') {`,
    para: `      if (true) {`,
    testes: [`${E}/geracao-temporal.test.ts`, `${E}/c1-mutacoes-guard.test.ts`] },

  { n: 18, desc: 'repetir capacidade', alvo: `${E}/geracao-temporal.ts`,
    de: `  if (capacidadesJaTestadas.has(cap)) {`,
    para: `  if (false) {`,
    testes: [`${E}/geracao-temporal.test.ts`] },

  { n: 19, desc: 'abortar só porque o mesmo plano apareceu sob capacidade menor', alvo: `${E}/geracao-temporal.ts`,
    de: `      ultimoExcede = { plano: alocado.plano, resultado: tentativa.resultado, capacidade };`,
    para: `      if (ultimoExcede) return { tipo: 'INCOMPATIVEL', planoTerminal: ultimoExcede.plano, resultado: ultimoExcede.resultado, capacidadeMinimaTestada: capacidade, invariantesPreservados: true };\n      ultimoExcede = { plano: alocado.plano, resultado: tentativa.resultado, capacidade };`,
    testes: [`${E}/geracao-temporal.test.ts`] },

  { n: 20, desc: 'usar capacidade negativa', alvo: `${E}/geracao-temporal.ts`,
    de: `  for (let capacidade = capacidadeInicial; capacidade >= capacidadeMinima; capacidade -= 1) {`,
    para: `  for (let capacidade = capacidadeInicial; capacidade >= capacidadeMinima - 5; capacidade -= 1) {`,
    testes: [`${E}/c1-mutacoes-guard.test.ts`] },

  { n: 21, desc: 'saltar capacidade intermediária (`5 → 3`)', alvo: `${E}/geracao-temporal.ts`,
    de: `  for (let capacidade = capacidadeInicial; capacidade >= capacidadeMinima; capacidade -= 1) {`,
    para: `  for (let capacidade = capacidadeInicial; capacidade >= capacidadeMinima; capacidade -= 2) {`,
    testes: [`${E}/geracao-temporal.test.ts`] },

  { n: 22, desc: 'herdar descanso degradado sem reiniciar a escada', alvo: `${E}/geracao-temporal.ts`,
    de: `    for (let nivel = 0; nivel < niveisDescanso; nivel += 1) {`,
    para: `    for (let nivel = niveisDescanso - 1; nivel < niveisDescanso; nivel += 1) {`,
    testes: [`${E}/geracao-temporal.test.ts`] },

  { n: 23, desc: 'cardio automático usar os `480 s` ou substituir dia resistido', alvo: `${E}/cardio-sessao.ts`,
    de: `  return { tipo: 'CALCULAVEL', segundos: Math.max(b - maxR, 0) };`,
    para: `  return { tipo: 'CALCULAVEL', segundos: Math.max(b + 480 - maxR, 0) };`,
    testes: [`${E}/cardio-sessao.test.ts`, `${E}/treino-cardio-semana.test.ts`] },

  { n: 24, desc: 'agendar cardio em dia não oferecido pelo usuário', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `      if (!destino.oferecido) continue; // só dia oferecido`,
    para: `      if (false) continue;`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `src/lib/c1-caminho-publico.test.ts`] },

  { n: 25, desc: 'alocar em dia igual/anterior à origem ou dar wrap-around', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `      if (destino.ordemNoHorizonte <= ordemOrigem) continue; // estritamente posterior; sem wrap`,
    para: `      if (false) continue;`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `src/lib/c1-caminho-publico.test.ts`] },

  { n: 26, desc: 'perder a duração prescrita/restante após adaptar cardio', alvo: `${E}/cardio-sessao.ts`,
    de: `      restanteAposOrigemSegundos: p.duracaoPrescritaSegundos - usada,`,
    para: `      restanteAposOrigemSegundos: 0,`,
    testes: [`${E}/cardio-sessao.test.ts`, `${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 27, desc: 'classificar cardio manual excedente como tolerância', alvo: `${E}/duracao-sessao.ts`,
    de: `  } else if (origem === 'EDITADO' && cardioPrescrito > 0 && cardioPrescrito > cardioDisponivelOtimista) {`,
    para: `  } else if (false) {`,
    testes: [`${E}/cardio-sessao.test.ts`, `${E}/duracao-golden.test.ts`] },

  { n: 28, desc: 'distribuir cardio antes do plano resistido terminal', alvo: `${E}/treino-montador.ts`,
    de: `    const diasResistidos = r.duracaoResistidaDias ?? r.duracaoDias ?? [];`,
    para: `    const diasResistidos = rotina.duracaoResistidaDias ?? rotina.duracaoDias ?? [];`,
    testes: [`src/lib/c1-caminho-publico.test.ts`] },

  { n: 29, desc: 'distribuir saldos antes de reservar o cardio próprio de todos os dias', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `      const jaNoDia = (cardioProprioNoDia.get(destino.diaId) ?? 0) + (recebidoNoDia.get(destino.diaId) ?? 0);`,
    para: `      const jaNoDia = (recebidoNoDia.get(destino.diaId) ?? 0);`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 30, desc: 'violar `prescrita = origem + destinos + descarte`', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `      st.descartada = st.saldo;`,
    para: `      st.descartada = 0;`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `src/lib/c1-caminho-publico.test.ts`] },

  { n: 31, desc: 'criar dois blocos no mesmo destino / ultrapassar a capacidade residual', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `      const parcela = Math.min(st.saldo, residual);`,
    para: `      const parcela = st.saldo;`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 32, desc: 'capacidade residual ignorando o cardio de origem do próprio dia', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `      const residual = Math.max(b - jaNoDia, 0);`,
    para: `      const residual = Math.max(b, 0);`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 33, desc: 'confiar em `CardioPlanejado` persistido divergente do recálculo', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `  if (assinaturaDistribuicao(canonica) !== assinaturaDistribuicao(params.distribuicaoObservada)) {`,
    para: `  if (false) {`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`] },

  { n: '34a', desc: 'materializar cardio de duração `0` (uso zero vira linhagem e o filtro aceita total 0)', alvo: `${E}/distribuicao-cardio-semana.ts`,
    edits: [
      { de: `    if (st.usadaOrigem > 0) {`, para: `    if (true) {` },
      { de: `    .filter(([, a]) => a.total > 0)`, para: `    .filter(([, a]) => a.total >= 0)` },
    ],
    testes: [`${E}/c1-mutacoes-guard.test.ts`, `src/lib/c1-caminho-publico.test.ts`] },

  { n: '34b', desc: 'omitir bloco de destino com soma positiva', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `    .filter(([, a]) => a.total > 0)`,
    para: `    .filter(() => false)`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `src/lib/c1-caminho-publico.test.ts`] },

  { n: '34c', desc: 'dar ao bloco duração diferente da soma de sua linhagem', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `    a.total += l.segundos;`,
    para: `    a.total += l.segundos + 1;`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `${E}/c1-mutacoes-guard.test.ts`] },

  { n: 35, desc: 'reutilizar `prescricao_id` entre origens', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `    if (prescIds.has(p.prescricaoId)) motivosEstruturais.push(\`prescricao_id duplicado: \${p.prescricaoId}\`);`,
    para: `    if (false) motivosEstruturais.push('x');`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `${E}/c1-mutacoes-guard.test.ts`] },

  { n: 36, desc: 'aceitar `ordem_prescricao` duplicada / ratear proporcionalmente', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `      if (set.has(p.ordemPrescricao)) motivosEstruturais.push(\`ordem_prescricao duplicada no dia \${p.diaOrigemId}: \${p.ordemPrescricao}\`);`,
    para: `      if (false) motivosEstruturais.push('x');`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `${E}/c1-mutacoes-guard.test.ts`] },

  { n: 37, desc: 'calcular cada prescrição do mesmo dia contra `B` integral', alvo: `${E}/cardio-sessao.ts`,
    de: `    const usada = capOk ? Math.min(p.duracaoPrescritaSegundos, restante) : 0;`,
    para: `    const usada = capOk ? Math.min(p.duracaoPrescritaSegundos, capacidade.tipo === 'CALCULAVEL' ? capacidade.segundos : 0) : 0;`,
    testes: [`${E}/cardio-sessao.test.ts`, `${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 38, desc: 'reduzir descanso pesado abaixo de `180 s`', alvo: `${E}/descanso.ts`,
    de: `export const PISO_DEGRADACAO_FORCA_PESADA = 180;`,
    para: `export const PISO_DEGRADACAO_FORCA_PESADA = 60;`,
    testes: [`${E}/descanso.test.ts`] },

  { n: '39a', desc: 'duplicar/substituir a fórmula canônica dentro do crítico', alvo: `${E}/critico.ts`,
    de: `import { avaliarDuracaoFinalDoDia } from './duracao-plano';`,
    para: `const avaliarDuracaoFinalDoDia = (..._args: Parameters<typeof import('./duracao-plano').avaliarDuracaoFinalDoDia>) => ({}) as ReturnType<typeof import('./duracao-plano').avaliarDuracaoFinalDoDia>;`,
    testes: [`${E}/convergencia-c1.test.ts`] },

  { n: '39b', desc: 'crítico ecoar o resultado publicado pelo gerador', alvo: `${E}/critico.ts`,
    de: `    const critico = avaliarDuracaoFinalDoDia(
      treino?.slots ?? [], ctx.nivel, orcamentoSeg, cardioCanonicoSegundos,
      cardioQualitativoEsperado,
    );`,
    para: `    const critico = dia.duracao;`,
    testes: [`${E}/convergencia-c1.test.ts`] },

  { n: 40, desc: 'manter a mesma `formula_version` após mudar faixa/estado/componentes', alvo: `${E}/duracao-sessao.ts`,
    de: `export const FORMULA_DURACAO_VERSION = 'tempo-v4';`,
    para: `export const FORMULA_DURACAO_VERSION = 'tempo-v3';`,
    testes: [`${E}/duracao-golden.test.ts`] },

  { n: 41, desc: 'aceitar commit semanal com revisão/fingerprint obsoleta', alvo: `${E}/cas.ts`,
    de: `  if (revAtual !== comando.expectedRevision) {`,
    para: `  if (false) {`,
    testes: [`${P}/plano-cas.test.ts`, `${P}/plano-cas-supabase.test.ts`] },

  { n: 42, desc: 'aceitar commit de `formula_version` antiga sobre o mesmo hash', alvo: `${E}/cas.ts`,
    de: `  if (comando.formulaVersion !== formulaVersionVigente) {`,
    para: `  if (false) {`,
    testes: [`${P}/plano-cas.test.ts`, `${P}/plano-cas-supabase.test.ts`] },

  { n: 43, desc: 'sobrescrever o baseline inicial de volume por tentativa intermediária', alvo: `${E}/geracao-temporal.ts`,
    de: `    slotsAntes: baseline.length,`,
    para: `    slotsAntes: terminal.length,`,
    testes: [`${E}/geracao-temporal.test.ts`] },

  { n: 44, desc: 'omitir o delta factual de frequência direta por grupo', alvo: `${E}/geracao-temporal.ts`,
    de: `    frequenciaDiretaPorGrupo[g] = { antes: ba.length, depois: te.length };`,
    para: `    frequenciaDiretaPorGrupo[g] = { antes: 0, depois: 0 };`,
    testes: [`${E}/geracao-temporal.test.ts`] },

  { n: 45, desc: 'validar cardio observado sem confrontar o construtor canônico', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `  const canonica = construirDistribuicaoCardioSemana(params.fatosBase);`,
    para: `  const canonica = params.distribuicaoObservada;`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 46, desc: 'usar cardio positivo em origem com `B`/`MAX_RESISTIDA` incalculável', alvo: `${E}/cardio-sessao.ts`,
    de: `    const usada = capOk ? Math.min(p.duracaoPrescritaSegundos, restante) : 0;`,
    para: `    const usada = capOk ? Math.min(p.duracaoPrescritaSegundos, restante) : p.duracaoPrescritaSegundos;`,
    testes: [`${E}/cardio-sessao.test.ts`, `${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 47, desc: 'alocar em destino sem capacidade conhecida', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `      if (b === undefined || !intSeguro(b) || !(b > 0)) continue; // capacidade desconhecida ⇒ pulado`,
    para: `      const bb = b ?? 999999; if (false) continue;`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 48, desc: 'calcular uso de cardio por fórmula local (não a primitiva única)', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `    const res = calcularUsosCardioNaOrigem(cap, entradaPrimitiva);`,
    para: `    const res = { capacidade: cap, usos: entradaPrimitiva.map((p) => ({ prescricaoId: p.prescricaoId, ordemPrescricao: p.ordemPrescricao, duracaoPrescritaSegundos: p.duracaoPrescritaSegundos, duracaoUsadaNaSessaoSegundos: p.duracaoPrescritaSegundos, restanteAposOrigemSegundos: 0 })), cardioOrigemNoDiaSegundos: 0, temPrescricaoInvalida: false };`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `${E}/convergencia-c1.test.ts`] },

  { n: 49, desc: 'persistir partes do agregado fora do mesmo CAS atômico', alvo: `${P}/plano-cas-supabase.ts`,
    de: `      p_payload: comando.aggregate,`,
    para: `      p_payload: {},`,
    testes: [`${P}/plano-cas-supabase.test.ts`] },

  { n: 50, desc: 'duração do destino ignorando parcelas recebidas', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `    for (const al of st.alocacoes) {`,
    para: `    for (const al of [] as typeof st.alocacoes) {`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`, `src/lib/c1-caminho-publico.test.ts`] },

  { n: 51, desc: 'ordenar origens pela inserção do objeto, não pela chave total canônica', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `  const origensOrdenadas = [...estadoPresc.values()].sort((a, b) =>`,
    para: `  const origensOrdenadas = [...estadoPresc.values()].sort(() => 0).sort((a, b) => 0 && (`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 52, desc: 'converter erro estrutural global em ressalva local', alvo: `${E}/distribuicao-cardio-semana.ts`,
    de: `  if (motivosEstruturais.length > 0) return estrutural(e, hash, motivosEstruturais);`,
    para: `  if (false) return estrutural(e, hash, motivosEstruturais);`,
    testes: [`${E}/distribuicao-cardio-semana.test.ts`] },

  { n: 53, desc: 'certificar plano do alocador que viole cobertura/equipamento/puxar≥empurrar', alvo: `${E}/geracao-temporal.ts`,
    de: `  if (!inv.ok) {`,
    para: `  if (false) {`,
    testes: [`${E}/geracao-temporal.test.ts`] },

  { n: 54, desc: 'entregar certificação antiga após conflito / repetir commit sem recomputar', alvo: `${P}/plano-cas.ts`,
    de: `  if (pre.tipo !== 'PROSSEGUIR') return pre; // conflito terminal na pré-decisão: nada é persistido`,
    para: `  if (pre.tipo !== 'PROSSEGUIR') return repo.commitAtomico(comando);`,
    testes: [`${P}/plano-cas-supabase.test.ts`, `${P}/plano-cas.test.ts`] },

  { n: 55, desc: 'esconder `ORCAMENTO_AUSENTE` quando também há motivo de cálculo', alvo: `${E}/duracao-plano.ts`,
    de: `      motivosLimite: orcamentoSegundos === undefined ? ['ORCAMENTO_AUSENTE'] : [],`,
    para: `      motivosLimite: [],`,
    testes: [`${E}/duracao-plano.test.ts`] },

  { n: 56, desc: 'avaliar duração antes dos invariantes (NAO_AVALIADO_ENTREGAVEL p/ plano inválido)', alvo: `${E}/treino-montador.ts`,
    de: `  if (violacoesBaseline.length > 0) {`,
    para: `  if (false) {`,
    testes: [`src/lib/c1-caminho-publico.test.ts`] },

  { n: 57, desc: 'aceitar plano final vazio por vacuidade no crítico independente', alvo: `${E}/critico.ts`,
    de: `  const convergiu = motivosEstruturais.length === 0 && conferencias.every((d) => d.converge);`,
    para: `  const convergiu = conferencias.every((d) => d.converge);`,
    testes: [`${E}/convergencia-c1.test.ts`] },

  { n: 58, desc: 'ocultar do modelo da agenda o cardio canônico que compartilha dia com musculação', alvo: `src/lib/semana.ts`,
    de: `        ...(cardioLegado ? { cardioIdx: cardioLegado.indice, cardio: cardioLegado.item } : {}),`,
    para: `        ...(false ? { cardioIdx: cardioLegado?.indice, cardio: cardioLegado?.item } : {}),`,
    testes: [`src/lib/c1-caminho-publico.test.ts`] },

  { n: 59, desc: 'recomeçar o índice do cardio depois de dias mistos', alvo: `src/lib/semana.ts`,
    de: `    const cardioIdx = cardioExato?.indice ?? (temOrdemCanonica ? cardioPorOrdem.get(ordemAtiva)?.indice : indiceLegado);`,
    para: `    const cardioIdx = indiceLegado;`,
    testes: [`src/lib/c1-caminho-publico.test.ts`] },

  { n: 60, desc: 'publicar candidato reduzido sem cobertura em vez de declarar SEM_PLANO_MENOR', alvo: `${E}/treino-montador.ts`,
    de: `      if (violacoesBaseline.length === 0 && violacoesDaRealocacao(plano).length > 0) {`,
    para: `      if (false) {`,
    testes: [`src/lib/c1-caminho-publico.test.ts`] },

  { n: 61, desc: 'certificar cardio qualitativo oferecido sem duração', alvo: `${E}/treino-montador.ts`,
    de: `      prescricao.cardio.tipo === 'sessoes_moderadas' && oferecidos.length > 0 && rg.tipo !== 'INCOMPATIVEL'`,
    para: `      false`,
    testes: [`${E}/dia-de-cardio-slot.test.ts`, `src/lib/c1-caminho-publico.test.ts`] },

  { n: 62, desc: 'crítico deixar de validar a distribuição observada contra fatos independentes', alvo: `${E}/critico.ts`,
    de: `    const validacao = validarDistribuicaoCardioSemana({ fatosBase: fatosReconstruidos, distribuicaoObservada: distribuicao });`,
    para: `    const validacao = { tipo: 'VALIDA' as const };`,
    testes: [`${E}/convergencia-c1.test.ts`] },

  { n: 63, desc: 'crítico aceitar permutação de treino_idx', alvo: `${E}/critico.ts`,
    de: `    if (dia.treinoIdx !== treinoIdxEsperado) {`,
    para: `    if (false) {`,
    testes: [`${E}/convergencia-c1.test.ts`] },

  { n: 64, desc: 'adaptador apagar cardio terminal inválido como se fosse ausência', alvo: `${E}/duracao-plano.ts`,
    de: `  const cardioInvalido = cardioMaterializadoSegundos !== 0
    && (!Number.isSafeInteger(cardioMaterializadoSegundos) || cardioMaterializadoSegundos <= 0);`,
    para: `  const cardioInvalido = false;`,
    testes: [`${E}/duracao-plano.test.ts`] },

  { n: 65, desc: 'apagar do plano final o cardio qualitativo oferecido sem duração', alvo: `${E}/treino-montador.ts`,
    de: `      const cardioSemDuracao = diasCardioSemDuracao.has(diaId);`,
    para: `      const cardioSemDuracao = false;`,
    testes: [`${E}/dia-de-cardio-slot.test.ts`, `src/lib/c1-caminho-publico.test.ts`, `${E}/convergencia-c1.test.ts`] },

  { n: 66, desc: 'certificar catálogo vazio por vacuidade estrutural', alvo: `${E}/treino-montador.ts`,
    de: `    const slots = r.dias.flatMap((d) => d.slots);`,
    para: `    const slots = r.dias.flatMap((d) => d.slots);\n    if (slots.length === 0) return [];`,
    testes: [`src/lib/c1-caminho-publico.test.ts`] },

  { n: 67, desc: 'crítico aprender a oferta de cardio do agregado avaliado', alvo: `${E}/critico.ts`,
    de: `  const oferecidos = ofertaExternaValida\n    ? ORDEM_SEMANA.filter((dia, indice) => ofertaExterna.includes(dia) || ofertaExterna.includes(indice))\n    : [];`,
    para: `  const oferecidos = fatosInformados?.diasHorizonte\n    .filter((d) => d.oferecido)\n    .map((d) => d.diaId)\n    .filter((d): d is Weekday => ORDEM_SEMANA.includes(d as Weekday)) ?? [];`,
    testes: [`${E}/convergencia-c1.test.ts`] },
];

const args = process.argv.slice(2);
const md = args.includes('--md');
const alvos = args.filter((a) => /^\d+[a-z]?$/.test(a));
const lista = alvos.length
  ? MUTACOES.filter((m) => alvos.includes(String(m.n)) || alvos.includes(String(m.n).replace(/[a-z]$/, '')))
  : MUTACOES;

// Pré-voo: um runner com âncora morta não é evidência. Falha antes de tocar qualquer fonte.
const ancorasMortas = lista.flatMap((m) => {
  const original = readFileSync(join(RAIZ, m.alvo), 'utf-8');
  const edits = m.edits ?? [{ de: m.de, para: m.para }];
  return edits.some((e) => !original.includes(e.de)) ? [m] : [];
});
if (ancorasMortas.length > 0) {
  for (const m of ancorasMortas) console.error(`${String(m.n).padStart(3)}  PATCH_NAO_APLICOU  ${m.desc}`);
  process.exit(1);
}

function rodaTestes(testes) {
  const vitest = join(RAIZ, 'node_modules', 'vitest', 'vitest.mjs');
  const r = spawnSync(process.execPath, [vitest, 'run', '--configLoader', 'runner', ...testes, '--silent'], {
    cwd: RAIZ, encoding: 'utf-8', timeout: 300000, windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const saida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  if (r.error?.code === 'ETIMEDOUT' || r.signal) return { tipo: 'TIMEOUT', saida };
  if (r.error || r.status == null) return { tipo: 'INFRA_ERRO', saida: `${r.error?.message ?? ''}\n${saida}` };
  if (r.status === 0) return { tipo: 'PASSOU', saida };
  const falhaDeTeste = /(?:Test Files|Tests)\s+\d+ failed|^\s*FAIL\s+/m.test(saida);
  return falhaDeTeste ? { tipo: 'FALHOU_TESTE', saida } : { tipo: 'INFRA_ERRO', saida };
}

// Baseline obrigatório: a união exata dos testes usados pelos mutantes precisa estar verde ANTES
// de qualquer edição. Assim uma suíte já vermelha nunca pode "matar" todos os mutantes.
const testesBaseline = [...new Set(lista.flatMap((m) => m.testes))];
const baseline = rodaTestes(testesBaseline);
if (baseline.tipo !== 'PASSOU') {
  console.error(`BASELINE_${baseline.tipo}: a prova de mutação foi abortada antes de editar fontes.`);
  console.error(baseline.saida.slice(-8000));
  process.exit(1);
}
if (!md) console.log(`BASELINE_VERDE  ${testesBaseline.length} arquivos de teste`);

const resultados = [];
for (const m of lista) {
  const caminho = join(RAIZ, m.alvo);
  const original = readFileSync(caminho, 'utf-8');
  const edits = m.edits ?? [{ de: m.de, para: m.para }];
  let status, detalhe = '';
  if (edits.some((e) => !original.includes(e.de))) {
    status = 'PATCH_NAO_APLICOU';
    detalhe = 'âncora não encontrada no fonte';
  } else {
    let mutado = original;
    for (const e of edits) mutado = mutado.replace(e.de, e.para);
    writeFileSync(caminho, mutado, 'utf-8');
    try {
      const execucao = rodaTestes(m.testes);
      status = execucao.tipo === 'PASSOU' ? 'SOBREVIVEU'
        : execucao.tipo === 'FALHOU_TESTE' ? 'MORTO'
          : execucao.tipo;
      if (status === 'TIMEOUT' || status === 'INFRA_ERRO') detalhe = execucao.saida.slice(-1000);
    } finally {
      writeFileSync(caminho, original, 'utf-8'); // restaura SEMPRE
    }
  }
  resultados.push({ ...m, status, detalhe });
  if (!md) console.log(`${String(m.n).padStart(3)}  ${status.padEnd(17)} ${m.desc}`);
}

const mortos = resultados.filter((r) => r.status === 'MORTO').length;
const sobreviveram = resultados.filter((r) => r.status === 'SOBREVIVEU');
const naoAplicou = resultados.filter((r) => r.status === 'PATCH_NAO_APLICOU');
const inconclusivos = resultados.filter((r) => r.status === 'TIMEOUT' || r.status === 'INFRA_ERRO');

if (md) {
  console.log('| # | Mutação normativa | Teste que a mata | Arquivo mutado | Resultado |');
  console.log('|---|---|---|---|---|');
  for (const r of resultados) {
    console.log(`| ${r.n} | ${r.desc} | \`${r.testes.join('`, `')}\` | \`${r.alvo}\` | **${r.status}** |`);
  }
}
console.log(`\nRESUMO: ${mortos}/${resultados.length} MORTOS · ${sobreviveram.length} sobreviveram · ${naoAplicou.length} sem âncora · ${inconclusivos.length} inconclusivos`);
if (sobreviveram.length) console.log('SOBREVIVERAM:', sobreviveram.map((r) => r.n).join(', '));
if (naoAplicou.length) console.log('SEM ÂNCORA:', naoAplicou.map((r) => r.n).join(', '));
if (inconclusivos.length) console.log('INCONCLUSIVOS:', inconclusivos.map((r) => r.n).join(', '));
process.exitCode = sobreviveram.length || naoAplicou.length || inconclusivos.length ? 1 : 0;
