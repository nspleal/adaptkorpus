import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrarSessao } from './session';
import { linhaParaPerfil, type ProfileRow } from './persistencia/perfil-profile';
import { recomputarPlano } from './plano';
import { vereditoDoPlano } from './veredito-motor';
import type { PerfilResumo } from '@/components/painel/Painel';

/**
 * 🔴 D11 (auditoria 2026-09-11 sobre `a40f8af`) — A ENTRADA COMPLETA, NAS DUAS BORDAS.
 *
 * D6 fechou os quatro blocos de TREINO. O que ficou cru foram os ESCALARES, nos dois caminhos
 * de hidratação: o blob do `localStorage` (`migrarSessao`) e o jsonb da linha `profile`
 * (`linhaParaPerfil`). Três consequências medidas, e este arquivo cobre as três:
 *
 *  1. FALHA NÃO TRATADA — `nivelExperiencia`/`objetivo`/`flagsSaude` fora do domínio lançavam
 *     `TypeError` dentro de `montar()`, o app caía no error boundary e o botão "Tentar de
 *     novo" relia o MESMO blob: laço sem saída até limpar os dados do site.
 *  2. PERDA SILENCIOSA — `treinoDias: ["xyz","seg"]` derrubava a agenda de 4 para 1 dia com
 *     `avisosHidratacao = 0` e veredito verde.
 *  3. CERTIFICAÇÃO SOBRE LIXO — `tempoPorSessaoMin: 1e9` gerava plano CERTIFICADO.
 *
 * 🔒 A decisão da coordenação, que estes testes travam: preservar o que é válido, NUNCA
 * assumir um valor no lugar do ilegível ("saudável", "iniciante" ou 240 min são invenção
 * igual), e suspender a geração oferecendo correção utilizável.
 */

const PERFIL_OK = {
  sexo: 'masculino', idade: 30, alturaCm: 175, pesoKg: 75, objetivo: 'saude',
  nivelAtividade: 'moderado', nivelExperiencia: 'intermediario', equipamento: 'academia',
  preferencia: null, alergenos: [], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], naoCurto: [], pratosCansados: [], favoritos: [],
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
};

const hidratar = (mut: Record<string, unknown>): PerfilResumo => {
  const r = migrarSessao(JSON.stringify({ v: 2, perfil: { ...PERFIL_OK, ...mut } }));
  expect(r, 'a migração descartou o perfil inteiro — apagar é justamente o que não se pode fazer').not.toBeNull();
  return r!.perfil;
};

const linha = (pref: Record<string, unknown>, over: Record<string, unknown> = {}): PerfilResumo =>
  linhaParaPerfil({
    sexo: 'masculino', peso_kg: 75, altura_cm: 175, idade: 30,
    nivel_atividade: 'moderado', objetivo: 'saude',
    gestacao_amamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false,
    preferencia_alimentar: null, alergenos: [],
    ...over,
    preferencias: {
      nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
      treinoDias: ['seg', 'ter', 'qui', 'sex'], diasDisponiveis: 4, tempoPorSessaoMin: 60,
      naoCurto: [], favoritos: [], pratosCansados: [], ...pref,
    },
  } as unknown as ProfileRow);

const gerar = (p: PerfilResumo) => recomputarPlano(p, { semanaCiclo: { semana: 1 } });
const invalidos = (p: PerfilResumo) => p.camposInvalidos ?? [];

describe('D11 · o perfil válido atravessa sem marca e sem aviso', () => {
  it('nada é marcado, nada é avisado e o plano sai (anti-vacuidade dos casos abaixo)', () => {
    const p = hidratar({});
    expect(invalidos(p)).toEqual([]);
    expect(p.avisosHidratacao).toBeUndefined();
    expect(gerar(p).treino.rotina, 'perfil íntegro deixou de gerar plano').toBeTruthy();
  });

  it('a mesma régua vale na linha do servidor', () => {
    const p = linha({});
    expect(invalidos(p)).toEqual([]);
    expect(gerar(p).treino.rotina).toBeTruthy();
  });
});

describe('D11 · escalar ilegível suspende a geração — e não inventa valor', () => {
  const CASOS: { nome: string; mut: Record<string, unknown>; campo: string }[] = [
    { nome: 'nivelExperiencia fora do enum', mut: { nivelExperiencia: 'profissional' }, campo: 'nivelExperiencia' },
    { nome: 'objetivo fora do enum', mut: { objetivo: 'hipertrofia' }, campo: 'objetivo' },
    { nome: 'equipamento fora do enum', mut: { equipamento: 'halteres' }, campo: 'equipamento' },
    { nome: 'sexo fora do enum', mut: { sexo: 'outro' }, campo: 'sexo' },
    { nome: 'nivelAtividade fora do enum', mut: { nivelAtividade: 'atleta' }, campo: 'nivelAtividade' },
    { nome: 'flagsSaude nulo', mut: { flagsSaude: null }, campo: 'flagsSaude' },
    { nome: 'flagsSaude parcial', mut: { flagsSaude: { renal: false } }, campo: 'flagsSaude' },
    { nome: 'tempo absurdo (1e9)', mut: { tempoPorSessaoMin: 1e9 }, campo: 'tempoPorSessaoMin' },
    { nome: 'tempo zero', mut: { tempoPorSessaoMin: 0 }, campo: 'tempoPorSessaoMin' },
    { nome: 'tempo negativo', mut: { tempoPorSessaoMin: -60 }, campo: 'tempoPorSessaoMin' },
    { nome: 'tempo como texto', mut: { tempoPorSessaoMin: 'abc' }, campo: 'tempoPorSessaoMin' },
    { nome: 'tempo ausente', mut: { tempoPorSessaoMin: undefined }, campo: 'tempoPorSessaoMin' },
    { nome: 'preferência alimentar fora do par', mut: { preferencia: 'carnivoro' }, campo: 'preferencia' },
    { nome: 'alergênios não-lista', mut: { alergenos: 'leite' }, campo: 'alergenos' },
    { nome: 'peso não-numérico', mut: { pesoKg: 'oitenta' }, campo: 'pesoKg' },
  ];

  for (const c of CASOS) {
    it(`${c.nome}: nomeia o campo, não gera plano e não derruba nada`, () => {
      const p = hidratar(c.mut);
      expect(invalidos(p), `campo não nomeado para a correção`).toContain(c.campo);
      let r!: ReturnType<typeof gerar>;
      expect(() => { r = gerar(p); }, 'falha não tratada — é o TypeError de volta').not.toThrow();
      expect(r.treino.rotina, 'plano gerado sobre campo ilegível').toBeNull();
      expect(r.dieta.plano, 'dieta gerada sobre campo ilegível').toBeNull();
      expect(vereditoDoPlano(r.treino.rotina, 60), 'veredito sem plano').toBeNull();
      expect(p.avisosHidratacao?.length, 'suspensão sem aviso é recusa silenciosa').toBeGreaterThan(0);
    });
  }

  it('a suspensão NÃO assume "saudável": as flags ilegíveis continuam ilegíveis', () => {
    const p = hidratar({ flagsSaude: null });
    expect(p.flagsSaude, 'as flags foram substituídas por um objeto de conveniência').toBeNull();
    expect(gerar(p).dieta.gate.comportamento).toBe('ROTEAR');
  });

  it('a suspensão NÃO assume "iniciante": o valor ilegível é preservado para a correção', () => {
    const p = hidratar({ nivelExperiencia: 'profissional' });
    expect(p.nivelExperiencia, 'o valor foi apagado — a pessoa perde a pista do que corrigir')
      .toBe('profissional');
  });

  it('o TREINO MANUAL e as preferências sobrevivem à suspensão', () => {
    const rotinaCustom = { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e14'], seriesPorExercicio: { e14: 4 } }] };
    const preferencias = { banidos: ['e9'], trocas: [{ de: 'e1', para: 'e2' }] };
    const p = hidratar({ nivelExperiencia: 'profissional', rotinaCustom, preferencias, favoritos: ['e22'] });
    expect(p.rotinaCustom).toEqual(rotinaCustom);
    expect(p.preferencias).toEqual(preferencias);
    expect(p.favoritos).toEqual(['e22']);
  });

  it('linha legada do servidor segue a MESMA régua (a barreira não pode existir só na API pública)', () => {
    for (const pref of [{ nivelExperiencia: 'profissional' }, { tempoPorSessaoMin: undefined }, { equipamento: 'halteres' }]) {
      const p = linha(pref);
      expect(invalidos(p).length, JSON.stringify(pref)).toBeGreaterThan(0);
      expect(gerar(p).treino.rotina).toBeNull();
    }
    const semFlags = linha({}, { renal: null });
    expect(invalidos(semFlags)).toContain('flagsSaude');
  });
});

describe('D11 · o que tem dono a jusante continua indo para o dono', () => {
  /**
   * 🔒 A FAIXA de idade/peso/altura é do GATE DE SAÚDE, que já roteia e tem a frase para
   * explicar. Tratá-la aqui transformaria um perfil legado de 17 anos — legítimo, roteado
   * desde sempre — em "perfil corrompido", que é regressão, não correção.
   */
  it('idade fora da faixa continua sendo ROTEAR do gate, não suspensão', () => {
    const p = hidratar({ idade: 17 });
    expect(invalidos(p)).toEqual([]);
    expect(gerar(p).dieta.gate.comportamento).toBe('ROTEAR');
    expect(gerar(p).dieta.gate.motivos.join(' ')).toMatch(/faixa plausível/);
  });

  it('série manual fora de faixa continua sendo recusada COM AVISO pelo montador (D3)', () => {
    const p = hidratar({
      rotinaCustom: { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e14'], seriesPorExercicio: { e14: 1e9 } }] },
    });
    expect(invalidos(p)).toEqual([]);
    const rotina = gerar(p).treino.rotina!;
    expect(rotina.avisos.join(' ')).toMatch(/não é um número inteiro/);
  });
});

describe('D11 · a agenda não encolhe em silêncio', () => {
  it('dia fora do domínio: o dia válido fica, a perda é dita e a contagem acompanha', () => {
    const p = hidratar({ treinoDias: ['xyz', 'seg'] });
    expect(p.treinoDias).toEqual(['seg']);
    expect(p.diasDisponiveis).toBe(1);
    expect(p.avisosHidratacao?.join(' '), 'agenda reduzida sem uma palavra').toMatch(/dias de treino/);
    expect(invalidos(p), 'um dia ilegível não invalida o perfil inteiro').toEqual([]);
  });

  it('agenda ausente cai na retrocompat declarada (contagem válida ⇒ agenda padrão)', () => {
    const p = linha({ treinoDias: undefined, diasDisponiveis: 3 });
    expect(p.treinoDias).toHaveLength(3);
    expect(invalidos(p)).toEqual([]);
  });

  it('agenda ilegível E contagem ilegível ⇒ suspensão (não se inventa a semana de ninguém)', () => {
    const p = linha({ treinoDias: 'seg', diasDisponiveis: 0 });
    expect(invalidos(p)).toContain('treinoDias');
    expect(gerar(p).treino.rotina).toBeNull();
  });
});

describe('D11 · listas recuperáveis: o item ilegível sai, o irmão fica', () => {
  it('equipamentos de casa: o inválido some, o válido permanece, e a perda é dita', () => {
    const p = hidratar({ equipamento: 'casa', equipamentosCasa: ['halteres', 'esteira_espacial'] });
    expect(p.equipamentosCasa).toEqual(['halteres']);
    expect(p.avisosHidratacao?.join(' ')).toMatch(/equipamento de casa/);
    expect(invalidos(p)).toEqual([]);
  });

  it('favoritos e "não curto" com item ilegível não apagam a lista inteira', () => {
    const p = hidratar({ favoritos: ['e14', 7], naoCurto: ['leite', null] });
    expect(p.favoritos).toEqual(['e14']);
    expect(p.naoCurto).toEqual(['leite']);
  });

  it('opcional ilegível some com aviso, sem suspender a geração', () => {
    const p = hidratar({ cardioFavorito: 'natacao_sincronizada', orcamento: 'infinito' });
    expect(p.cardioFavorito).toBeUndefined();
    expect(p.orcamento).toBeUndefined();
    expect(invalidos(p)).toEqual([]);
    expect(gerar(p).treino.rotina).toBeTruthy();
  });
});

describe('D11 · a recuperação é utilizável e NÃO repete o mesmo erro', () => {
  const appPage = readFileSync('src/app/app/page.tsx', 'utf8');
  const onboarding = readFileSync('src/app/onboarding/page.tsx', 'utf8');

  it("o /app checa a suspensão ANTES de recomputar e NÃO limpa a sessão nesse caminho", () => {
    const guard = appPage.indexOf('if (!estado || estado.perfil.camposInvalidos?.length) return null;');
    expect(guard).toBeGreaterThan(-1);
    expect(appPage.indexOf('recomputarPlano(estado.perfil')).toBeGreaterThan(guard);
    expect(appPage).not.toContain('limparSessao(');
    expect(appPage).toContain('camposInvalidos?.length) return <PerfilPrecisaDeCorrecao');
  });

  it('a tela de suspensão nomeia os campos e leva ao modo correção — sem botão de repetir', () => {
    expect(appPage).toContain('PerfilPrecisaDeCorrecao');
    expect(appPage).toMatch(/ROTULOS_CAMPOS_PERFIL\[c\]/);
    expect(appPage).toMatch(/onCorrigir=\{\(\) => router\.push\('\/onboarding\?corrigir=1'\)\}/);
    const tela = appPage.slice(appPage.indexOf('function PerfilPrecisaDeCorrecao'));
    expect(tela, 'um "tentar de novo" aqui relê o mesmo blob e recria o laço').not.toMatch(/Tentar de novo/);
  });

  it('o onboarding em modo correção não devolve a pessoa para /app (o laço pela outra ponta)', () => {
    expect(onboarding).toMatch(/corrigir'\) === '1'/);
    expect(onboarding).toMatch(/if \(!corrigindo\) \{ router\.replace\('\/app'\); return; \}/);
  });

  it('a correção preserva o perfil anterior e alcança o servidor (senão o reload traz a corrupção de volta)', () => {
    // A mescla e o CAS têm testes comportamentais em recuperacao-perfil.test.ts.
    // Aqui guardamos a ligação com a tela e a espera antes de gravar o cache.
    expect(onboarding).toContain('mesclarPerfilCorrigido(anterior, doWizard)');
    expect(onboarding).toMatch(/await persistirCorrecao\([\s\S]*if \(!resultado.ok\)[\s\S]*return;[\s\S]*salvarSessao\(resumo, entradaCorrigida\)/);
  });

  it('o perfil corrigido volta a gerar plano (a saída do laço existe de fato)', () => {
    const corrompido = hidratar({ nivelExperiencia: 'profissional' });
    expect(gerar(corrompido).treino.rotina).toBeNull();
    // O que o modo correção grava: o perfil anterior com os escalares reescritos por cima.
    const corrigido = migrarSessao(JSON.stringify({
      v: 2,
      perfil: { ...corrompido, nivelExperiencia: 'intermediario', camposInvalidos: undefined, avisosHidratacao: undefined },
    }))!.perfil;
    expect(invalidos(corrigido)).toEqual([]);
    expect(gerar(corrigido).treino.rotina).toBeTruthy();
  });
});
