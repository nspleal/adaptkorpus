/**
 * 🦴 COBERTURA MUSCULAR DO EDITOR — o que a tela pode afirmar, e o que ela não pode.
 *
 * Os casos são ancorados no CATÁLOGO REAL e no pacote anatômico real: nenhum estado é
 * fabricado por fixture. O que estes testes protegem não é um número — é a diferença entre
 * "identificada", "participa como auxiliar", "depende de execução não declarada" e "ninguém
 * no catálogo faz isso". Colapsar duas delas é o defeito que a feature existe para não ter.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { ALVOS_ANATOMICOS, RESSALVA_COBERTURA } from '../data/alvos-anatomicos';
import { coberturaDoDia, gruposDoDia } from './cobertura-editor';
import { poolElegivel } from './treino-montador';
import { GRUPOS_COM_ALVOS } from './cobertura-anatomica';
import type { Exercise } from '../data/types';

const ex = (id: string): Exercise => EXERCISES.find((e) => e.id === id)!;
const ACADEMIA = poolElegivel(EXERCISES, { equipamento: 'academia', nivelExperiencia: 'avancado' });
const CASA_SEM_NADA = poolElegivel(EXERCISES, { equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'iniciante' });

const dia = (ids: readonly string[], elegiveis: readonly Exercise[] = ACADEMIA) =>
  coberturaDoDia({ nome: 'Dia', escolhidos: ids.map(ex), elegiveis });

/** Estado de uma parte pelo NOME de tela — é o que a pessoa lê. */
const estado = (c: ReturnType<typeof coberturaDoDia>, nome: string) =>
  c.grupos.flatMap((g) => g.partes).find((p) => p.nome === nome)?.estado;

describe('🦴 o escopo: os grupos DAQUELE dia, e só eles', () => {
  it('um dia de peito não deve nada a perna — o corpo inteiro não vira lista de faltantes', () => {
    const c = dia(['e1']);
    expect(c.grupos.map((g) => g.grupo)).toEqual(['peito']);
    // Se o escopo vazasse, as 44 fichas do pacote apareceriam aqui.
    expect(c.grupos.flatMap((g) => g.partes).length).toBeLessThan(Object.keys(ALVOS_ANATOMICOS).length);
  });

  it('cada grupo escolhido entra uma vez, na ordem estável do catálogo', () => {
    const c = dia(['e64', 'e1']); // posterior + peito, nesta ordem de escolha
    expect(c.grupos.map((g) => g.grupo)).toEqual(['peito', 'posterior']);
  });

  it('só grupos que o pacote classifica — nada é inventado para os que ele não tem', () => {
    for (const g of gruposDoDia(EXERCISES)) expect(GRUPOS_COM_ALVOS).toContain(g);
  });

  it('exercício sem grupo primário (cardio) não cria grupo nenhum', () => {
    const cardio = EXERCISES.find((e) => e.padraoMovimento === 'cardio')!;
    expect(coberturaDoDia({ nome: 'C', escolhidos: [cardio], elegiveis: ACADEMIA }).grupos).toEqual([]);
  });
});

describe('🔒 os quatro graus de evidência não se colapsam', () => {
  it('ação direta declarada ⇒ IDENTIFICADA, com o exercício que a aborda', () => {
    const c = dia(['e1']);
    const pc = c.grupos[0]!.partes.find((p) => p.nome.startsWith('Peitoral — clavicular'))!;
    expect(pc.estado).toBe('identificada');
    expect(pc.porExercicios).toEqual(['e1']);
    expect(pc.sugestoes).toEqual([]);
  });

  it('participação AUXILIAR não fecha cobertura — vira o seu próprio estado', () => {
    // e85 (elevação de pernas): reto abdominal e oblíquos entram como auxiliares.
    const c = dia(['e85']);
    expect(estado(c, 'Reto abdominal — parede anterior')).toBe('participacao_auxiliar');
    expect(estado(c, 'Oblíquo externo — parede lateral')).toBe('participacao_auxiliar');
    // 🔴 E não conta como identificada em lugar nenhum da conta.
    const core = c.grupos.find((g) => g.grupo === 'core')!;
    expect(core.partes.filter((p) => p.estado === 'identificada').map((p) => p.nome)).toEqual([]);
  });

  it('condição de execução NÃO declarada fica PENDENTE — nem coberta, nem negada', () => {
    // e104 (hiperextensão lombar): eretores só são diretos sob a execução declarada.
    const c = dia(['e104']);
    const er = c.grupos[0]!.partes.find((p) => p.nome.startsWith('Eretores'))!;
    expect(er.estado).toBe('condicional_pendente');
    expect(er.condicoesPendentes.map((x) => x.exercicioId)).toEqual(['e104']);
    expect(er.condicoesPendentes[0]!.quando).toEqual({ movimento: 'extensao_coluna' });
    expect(er.porExercicios).toEqual([]);
  });

  it('a mesma condição DECLARADA passa a contar — e só então', () => {
    const semDeclarar = dia(['e104']);
    const declarado = coberturaDoDia({
      nome: 'Dia', escolhidos: [ex('e104')], elegiveis: ACADEMIA,
      condicoesPorId: { e104: { movimento: 'extensao_coluna' } },
    });
    expect(estado(semDeclarar, 'Eretores da coluna — região lombar')).toBe('condicional_pendente');
    expect(estado(declarado, 'Eretores da coluna — região lombar')).toBe('identificada');
  });

  it('condição inválida não vira cobertura: cai para a consulta sem condição', () => {
    const invalido = coberturaDoDia({
      nome: 'Dia', escolhidos: [ex('e104')], elegiveis: ACADEMIA,
      condicoesPorId: { e104: { movimento: 'inexistente' } },
    });
    expect(estado(invalido, 'Eretores da coluna — região lombar')).toBe('condicional_pendente');
  });
});

describe('🔴 lacuna é lacuna — nenhuma cobertura é inventada', () => {
  it('alvo sem candidato no catálogo é DECLARADO como tal, sem sugestão', () => {
    const c = dia(['e104']); // grupo lombar contém o multífido, que ninguém aborda
    const mu = c.grupos[0]!.partes.find((p) => p.nome.startsWith('Multífido'))!;
    expect(mu.estado).toBe('sem_candidato_no_catalogo');
    expect(mu.sugestoes).toEqual([]);
  });

  it('candidato existe mas nada é elegível ⇒ estado próprio, distinto da lacuna do catálogo', () => {
    // Em casa e sem equipamento, o glúteo médio/mínimo tem candidato no catálogo e nenhum liberado.
    const c = dia(['e57'], CASA_SEM_NADA);
    const gd = c.grupos[0]!.partes.find((p) => p.nome.startsWith('Glúteo médio'))!;
    expect(gd.estado).toBe('sem_candidato_elegivel');
    expect(gd.sugestoes).toEqual([]);
    // O MESMO alvo, com a academia liberada, deixa de ser "sem candidato elegível".
    expect(estado(dia(['e57']), 'Glúteo médio')).not.toBe('sem_candidato_elegivel');
  });
});

describe('🔒 as sugestões respeitam o pool do MOTOR — nunca o catálogo inteiro', () => {
  it('só sugere o que está no pool elegível recebido', () => {
    const c = dia(['e139']);
    const bf = c.grupos[0]!.partes.find((p) => p.nome === 'Braquiorradial')!;
    expect(bf.estado).toBe('sem_exercicio_identificado');
    expect(bf.sugestoes.length).toBeGreaterThan(0);
    const elegiveis = new Set(ACADEMIA.map((e) => e.id));
    for (const s of bf.sugestoes) expect(elegiveis.has(s.id)).toBe(true);
  });

  it('exercício BANIDO sai do pool e some das sugestões (mesma autoridade do motor)', () => {
    const c = dia(['e139']);
    const alvo = c.grupos[0]!.partes.find((p) => p.nome === 'Braquiorradial')!;
    const banido = alvo.sugestoes[0]!.id;
    const poolSemEle = poolElegivel(EXERCISES, { equipamento: 'academia', nivelExperiencia: 'avancado' },
      { trocas: [], banidos: [banido] });
    const depois = dia(['e139'], poolSemEle);
    const mesmoAlvo = depois.grupos[0]!.partes.find((p) => p.nome === 'Braquiorradial')!;
    expect(mesmoAlvo.sugestoes.map((s) => s.id)).not.toContain(banido);
  });

  it('não sugere o que já está no dia', () => {
    const c = dia(['e139', 'e73']);
    for (const g of c.grupos) for (const p of g.partes) {
      expect(p.sugestoes.map((s) => s.id)).not.toContain('e139');
      expect(p.sugestoes.map((s) => s.id)).not.toContain('e73');
    }
  });

  it('sugestão cuja cobertura depende de execução é MARCADA, com a condição', () => {
    // Sem e139 no dia, os flexores/extensores do punho só têm candidato condicional.
    const c = dia(['e73']);
    const wf = c.grupos[0]!.partes.find((p) => p.nome === 'Flexores do punho')!;
    const condicional = wf.sugestoes.find((s) => s.dependeDeExecucao);
    expect(condicional, 'nenhuma sugestão condicional foi marcada').toBeTruthy();
    expect(condicional!.condicoes.length).toBeGreaterThan(0);
  });

  it('teto de leitura: no máximo N sugestões por parte, e o N é parâmetro', () => {
    const c = coberturaDoDia({ nome: 'D', escolhidos: [ex('e139')], elegiveis: ACADEMIA, maxSugestoes: 1 });
    for (const g of c.grupos) for (const p of g.partes) expect(p.sugestoes.length).toBeLessThanOrEqual(1);
  });
});

describe('🔒 um exercício contempla VÁRIAS partes — não se exige um por parte', () => {
  it('um único exercício fecha as duas cabeças do peitoral', () => {
    const c = dia(['e1']);
    expect(c.grupos[0]!.identificadas).toBe(2);
    expect(c.grupos[0]!.partes.every((p) => p.porExercicios.length === 1)).toBe(true);
  });

  it('contar exercícios por parte não é a métrica: a conta é de PARTES', () => {
    const um = dia(['e1']);
    const dois = dia(['e1', 'e10']);
    // Acrescentar outro exercício de peito não aumenta o número de partes identificadas.
    expect(dois.grupos[0]!.identificadas).toBe(um.grupos[0]!.identificadas);
  });
});

describe('🔁 a cobertura REAGE à edição', () => {
  it('adicionar o exercício que faltava troca o estado da parte', () => {
    const antes = dia(['e139']);
    const alvo = antes.grupos[0]!.partes.find((p) => p.nome === 'Braquiorradial')!;
    expect(alvo.estado).toBe('sem_exercicio_identificado');
    const depois = dia(['e139', alvo.sugestoes[0]!.id]);
    expect(estado(depois, 'Braquiorradial')).toBe('identificada');
  });

  it('remover o último exercício de um grupo remove o grupo do diagnóstico', () => {
    expect(dia(['e1', 'e64']).grupos.map((g) => g.grupo)).toEqual(['peito', 'posterior']);
    expect(dia(['e64']).grupos.map((g) => g.grupo)).toEqual(['posterior']);
  });

  it('trocar um exercício por outro do mesmo grupo recalcula as partes', () => {
    const a = dia(['e41']);
    const b = dia(['e106']);
    expect(a.grupos[0]!.grupo).toBe(b.grupos[0]!.grupo);
    expect(a.grupos[0]!.partes.map((p) => p.estado))
      .not.toEqual(b.grupos[0]!.partes.map((p) => p.estado));
  });

  it('dia vazio não diz nada (não há desenho sobre o qual afirmar)', () => {
    expect(coberturaDoDia({ nome: 'D', escolhidos: [], elegiveis: ACADEMIA }).grupos).toEqual([]);
  });
});

describe('🔒 o que o módulo se recusa a fazer', () => {
  it('não devolve peso, score, quota nem veredito de dose', () => {
    // ⚠️ A RESSALVA sai da conta: ela é exatamente o texto que NEGA dose suficiente e
    // predominância — procurar essas palavras nela acusaria a única frase que deve existir.
    const { ressalva, ...resto } = dia(['e1', 'e85', 'e104', 'e139']);
    expect(ressalva).toBe(RESSALVA_COBERTURA);
    const texto = JSON.stringify(resto).toLowerCase();
    for (const proibido of ['score', 'peso', 'quota', 'ativacao', 'hipertrofia', 'suficiente', 'predomin']) {
      expect(texto.includes(proibido), `apareceu "${proibido}" na saída`).toBe(false);
    }
  });

  it('a ressalva do pacote acompanha toda leitura, sem variante que a omita', () => {
    expect(dia(['e1']).ressalva).toBe(RESSALVA_COBERTURA);
  });

  it('id fora do pacote é DECLARADO, e não derruba nem inventa cobertura', () => {
    const forjado = { ...ex('e1'), id: 'inexistente-999' } as Exercise;
    const c = coberturaDoDia({ nome: 'D', escolhidos: [forjado], elegiveis: ACADEMIA });
    expect(c.semClassificacao).toEqual(['inexistente-999']);
    expect(c.identificadas).toBe(0);
  });

  it('é determinístico: mesma entrada, mesma saída', () => {
    expect(JSON.stringify(dia(['e1', 'e85', 'e104']))).toBe(JSON.stringify(dia(['e1', 'e85', 'e104'])));
  });

  it('a soma bate: identificadas + sem exercício ≤ total de partes (o resto é auxiliar/pendente)', () => {
    const c = dia(['e85', 'e104', 'e139']);
    const total = c.grupos.reduce((n, g) => n + g.partes.length, 0);
    expect(c.identificadas + c.semExercicio).toBeLessThanOrEqual(total);
    expect(c.identificadas).toBe(c.grupos.reduce((n, g) => n + g.identificadas, 0));
  });
});
