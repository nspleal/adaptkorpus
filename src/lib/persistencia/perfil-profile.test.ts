import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { PerfilResumo } from '@/components/painel/Painel';
import { linhaComConsentimentos, linhaParaPerfil, perfilParaLinha } from './perfil-profile';

/**
 * Contrato schema↔tipo (DF 2026-07-05): os ~9 campos sem coluna vivem no jsonb `preferencias`;
 * o resto são colunas planas. O mapeamento é uma bijeção (round-trip fiel).
 */
const perfil: PerfilResumo = {
  sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80, objetivo: 'massa',
  nivelAtividade: 'moderado', nivelExperiencia: 'intermediario', equipamento: 'casa',
  preferencia: null, alergenos: ['gluten'], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], naoCurto: ['f1'], favoritos: ['e9'],
  equipamentosCasa: ['halteres', 'banco'], pratosCansados: [{ id: 'r1', ate: '2026-08-01' }],
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
};

describe('perfil-profile — mapeador PerfilResumo ↔ linha de profile', () => {
  it('round-trip fiel: linhaParaPerfil(perfilParaLinha(p)) === p', () => {
    expect(linhaParaPerfil(perfilParaLinha(perfil))).toEqual(perfil);
  });

  it('os 9 campos sem coluna ficam DENTRO de `preferencias` (não como coluna de topo)', () => {
    const linha = perfilParaLinha(perfil);
    expect(linha.preferencias).toEqual({
      nivelExperiencia: 'intermediario', equipamento: 'casa', equipamentosCasa: ['halteres', 'banco'],
      treinoDias: ['seg', 'ter', 'qui', 'sex'], diasDisponiveis: 4, tempoPorSessaoMin: 60,
      naoCurto: ['f1'], favoritos: ['e9'], pratosCansados: [{ id: 'r1', ate: '2026-08-01' }],
    });
    // não vazam como colunas de topo
    for (const k of ['favoritos', 'treinoDias', 'equipamentosCasa', 'nivelExperiencia']) {
      expect(k in linha).toBe(false);
    }
  });

  it('colunas planas mapeiam certo (camel→snake, flags de saúde, preferência null)', () => {
    const linha = perfilParaLinha(perfil);
    expect(linha.peso_kg).toBe(80);
    expect(linha.altura_cm).toBe(180);
    expect(linha.nivel_atividade).toBe('moderado');
    expect(linha.preferencia_alimentar).toBeNull();
    expect(linha.alergenos).toEqual(['gluten']);
    expect(linha.gestacao_amamentacao).toBe(false);
    expect(linha.diabetes).toBe(false);
  });

  it('opcionais ausentes (favoritos/equipamentosCasa) sobrevivem ao round-trip', () => {
    const semOpc: PerfilResumo = { ...perfil, favoritos: undefined, equipamentosCasa: undefined };
    expect(linhaParaPerfil(perfilParaLinha(semOpc))).toEqual(semOpc);
  });

  it('mesociclo + modo força (v2, DF 2026-07-08) vão no jsonb e fazem round-trip fiel', () => {
    const v2: PerfilResumo = { ...perfil, mesocicloInicio: '2026-07-08', modoForca: true };
    const linha = perfilParaLinha(v2);
    expect(linha.preferencias.mesocicloInicio).toBe('2026-07-08');
    expect(linha.preferencias.modoForca).toBe(true);
    for (const k of ['mesocicloInicio', 'modoForca']) expect(k in linha).toBe(false); // não vazam como coluna
    expect(linhaParaPerfil(linha)).toEqual(v2);
    // ausentes (conta v1) seguem ausentes — nada de default fantasma
    const semV2 = perfilParaLinha(perfil);
    expect('mesocicloInicio' in semV2.preferencias).toBe(false);
    expect(linhaParaPerfil(semV2)).toEqual(perfil);
  });

  it('linhaComConsentimentos: mescla aceite_18/termos/lgpd + carimbo (LGPD quer o registro)', () => {
    const linha = perfilParaLinha(perfil);
    const out = linhaComConsentimentos(linha, { aceite18: true, aceiteTermos: true, aceiteLgpd: true }, '2026-07-06T00:00:00.000Z');
    expect(out.aceite_18).toBe(true);
    expect(out.aceite_termos).toBe(true);
    expect(out.aceite_lgpd).toBe(true);
    expect(out.aceite_em).toBe('2026-07-06T00:00:00.000Z');
    expect(out.peso_kg).toBe(80); // linha original preservada
  });
});

/**
 * 🔻 3.5 — O FÓSSIL `mesocicloSemana` SAI DO BANCO SEM MIGRATION (2026-08-01).
 *
 * Era cache sem consumidor: a semana do ciclo sempre foi derivada de `mesocicloInicio` +
 * hoje + as datas das sessões, e o único read do campo comparava o valor contra ele mesmo
 * para decidir se se reescrevia. O sintoma que o denunciou: contas com `semana = 2` e ZERO
 * treinos registrados.
 *
 * 🔒 **Ignorar não bastaria.** O valor está gravado no `preferencias` de quem já usou; sem
 * podar na LEITURA ele voltaria ao banco no save seguinte e continuaria visível para
 * telemetria, suporte e export LGPD — que é o motivo pelo qual o item existe.
 * **Poda na leitura + ausência na escrita = o campo some no próximo save.**
 */
describe('🔻 3.5 — o fóssil `mesocicloSemana` é podado, não só ignorado', () => {
  it('a leitura de uma conta LEGADA não traz o campo para o perfil', () => {
    const linha = perfilParaLinha(perfil);
    const legada = {
      ...linha,
      preferencias: { ...linha.preferencias, mesocicloInicio: '2026-07-08', mesocicloSemana: 2 },
    };
    const lido = linhaParaPerfil(legada) as unknown as Record<string, unknown>;
    expect('mesocicloSemana' in lido, 'o fóssil entrou no perfil').toBe(false);
    // Anti-vacuidade: o vizinho no MESMO jsonb continua atravessando.
    expect(lido.mesocicloInicio, 'a poda levou o campo errado junto').toBe('2026-07-08');
  });

  it('🔒 e o round-trip APAGA o campo: ler a conta legada e salvar de volta some com ele', () => {
    const linha = perfilParaLinha(perfil);
    const legada = {
      ...linha,
      preferencias: { ...linha.preferencias, mesocicloInicio: '2026-07-08', mesocicloSemana: 2 },
    };
    expect('mesocicloSemana' in legada.preferencias, 'o caso precisa começar COM o fóssil').toBe(true);
    const depois = perfilParaLinha(linhaParaPerfil(legada));
    expect('mesocicloSemana' in depois.preferencias, 'o fóssil voltou ao banco').toBe(false);
    expect(depois.preferencias.mesocicloInicio).toBe('2026-07-08');
  });
});

/**
 * 🔒 O GUARD DA AUSÊNCIA (3.5). O campo saiu como CLASSE — tipo, validação, serialização e o
 * efeito que gravava. Este teste falha se ele reaparecer no CÓDIGO de `src/`.
 *
 * ⚠️ A isenção é ESTRUTURAL, não uma lista de nomes:
 *  · **arquivos de teste** podem citá-lo — vários EXISTEM para proibi-lo como entrada do
 *    motor (`mesociclo-espelho`, `trilhos-call-sites`), e uma lista enumerada obrigaria a
 *    editá-la a cada guard novo da mesma regra;
 *  · **`perfil-profile.ts`** continua declarando o legado para poder PODÁ-LO na leitura das
 *    contas antigas. Sem essa linha não haveria como tirar o fóssil do banco.
 * Um arquivo de CÓDIGO novo que o mencione cai aqui, que é o que importa.
 */
describe('🔒 3.5 — `mesocicloSemana` não pode reaparecer no código de src/', () => {
  const PODADOR = 'src/lib/persistencia/perfil-profile.ts';

  function varrer(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? varrer(p) : (/\.tsx?$/.test(p) ? [p] : []);
    });
  }
  const fontes = () => varrer(join(process.cwd(), 'src'))
    .map((f) => [relative(process.cwd(), f).replace(/\\/g, '/'), readFileSync(f, 'utf8')] as const);

  it('nenhum arquivo de CÓDIGO menciona o campo, exceto o que o poda', () => {
    const reincidentes = fontes()
      .filter(([f]) => !/\.test\.tsx?$/.test(f) && f !== PODADOR)
      .filter(([, src]) => /mesocicloSemana/.test(src))
      .map(([f]) => f);
    expect(reincidentes, 'o fóssil voltou ao código').toEqual([]);
  });

  it('🔒 e o PODADOR continua podando — a isenção não pode virar um campo vivo de novo', () => {
    const src = fontes().find(([f]) => f === PODADOR)![1];
    // Declarado só no tipo do jsonb; nunca escrito de volta, nunca lido para o perfil.
    expect(src).toMatch(/mesocicloSemana\?: number;/);
    expect(src, 'voltou a ESCREVER o campo no banco').not.toMatch(/\{ mesocicloSemana:/);
    expect(src, 'voltou a LER o campo para o perfil').not.toMatch(/pref\.mesocicloSemana/);
  });

  it('anti-vacuidade: a varredura lê o repositório e ENXERGA o padrão onde ele existe', () => {
    const todos = fontes();
    expect(todos.length, 'a varredura não achou arquivo nenhum').toBeGreaterThan(50);
    const achados = todos.filter(([, src]) => /mesocicloSemana/.test(src)).map(([f]) => f);
    // Tem de achar o podador e ao menos os guards que proíbem o campo como entrada.
    expect(achados, 'a varredura ficou cega').toContain(PODADOR);
    expect(achados.filter((f) => /\.test\.tsx?$/.test(f)).length).toBeGreaterThanOrEqual(2);
  });

  it('e o VIZINHO `mesocicloInicio` continua vivo (não se levou a fonte junto)', () => {
    const comInicio = fontes().filter(([, src]) => /mesocicloInicio/.test(src));
    expect(comInicio.length, 'a âncora do ciclo sumiu junto com o espelho').toBeGreaterThan(2);
  });
});
