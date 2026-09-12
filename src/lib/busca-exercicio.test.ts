/**
 * 🔎 BUSCA DO CATÁLOGO — fonte única, e o que ela tem de achar.
 *
 * 🔴 O defeito reproduzido antes do conserto (auditoria de visibilidade, 2026-09-12), medido
 * no componente real a 1024×768 e a 375×812: dez consultas em inglês devolviam ZERO na
 * biblioteca e caíam no estado vazio — "push-up" 0/6, "squat" 0/13, "bench press" 0/5,
 * "deadlift" 0/5, "row" 0/15, "plank" 0/4, "lunge" 0/6, "dip" 0/2, "pull-up" 0/1,
 * "bike" 0/1 (o segundo número é o que o registro pós-fato achava no MESMO catálogo).
 * Na direção oposta, "glúteo" achava 33 na biblioteca e 4 no registro.
 *
 * 🔒 O guard tem DUAS pernas, porque uma só não sustenta:
 *  ① a função acha por nome PT, nome EN e músculo — o contrato de campos;
 *  ② as duas telas CHAMAM esta função — sem isso, o contrato fica num lugar e as telas
 *    divergem de novo (foi exatamente assim que o defeito nasceu).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { casaComBusca, normalizarBusca } from './busca-exercicio';
import { EXERCISES } from './data/exercises';

const acha = (q: string) => EXERCISES.filter((e) => casaComBusca(e, q)).map((e) => e.id);

describe('🔎 ① a busca lê os três campos', () => {
  it('nome em PORTUGUÊS, com e sem acento', () => {
    expect(acha('flexão')).toContain('e1');
    expect(acha('flexao')).toEqual(acha('flexão'));
    expect(acha('AGACHAMENTO LIVRE')).toContain('e3');
  });

  it('nome em INGLÊS — as dez consultas que antes davam zero', () => {
    const esperado: Record<string, string> = {
      'push-up': 'e1', 'pull-up': 'e21', squat: 'e3', 'bench press': 'e9', deadlift: 'e26',
      row: 'e45', plank: 'e7', lunge: 'e16', dip: 'e100', bike: 'e29',
    };
    for (const [consulta, id] of Object.entries(esperado)) {
      const r = acha(consulta);
      expect(r.length, `"${consulta}" não achou nada`).toBeGreaterThan(0);
      expect(r, `"${consulta}" não achou ${id}`).toContain(id);
    }
  });

  it('MÚSCULO, inclusive quando só o `grupoMuscular` tem o termo', () => {
    // e16 "Afundo (avanço)" é "Quadríceps, glúteos": achado por glúteo sem ter no nome.
    expect(acha('gluteo')).toContain('e16');
    expect(acha('glúteo')).toEqual(acha('gluteo'));
    expect(acha('triceps').length).toBeGreaterThan(10);
  });

  it('consulta vazia (ou só espaço) NÃO filtra — campo em branco não é filtro', () => {
    expect(acha('')).toHaveLength(EXERCISES.length);
    expect(acha('   ')).toHaveLength(EXERCISES.length);
  });

  it('a busca não inventa resultado: termo ausente devolve vazio', () => {
    expect(acha('zzqx-nao-existe')).toEqual([]);
  });

  /**
   * 🔒 O par que a auditoria pediu para preservar (D20): "pulldown" nomeia os DOIS na
   * academia, e eles continuam DUAS entradas distintas — a busca acha as duas, não funde.
   */
  it('e49 (puxada alta) e e126 (pulldown de braços estendidos) seguem distintos', () => {
    // Com o `nomeEn` lido, "pulldown" passa a achar TAMBÉM as variantes que só o inglês
    // nomeava assim (e50 "Close-Grip Pulldown", e51 "Single-Arm Pulldown", e120 "Band Lat
    // Pulldown") — e "lat pulldown" acha e49 e e120, os dois que se chamam LAT pulldown.
    // Resultado a MAIS, nunca fusão: cada id continua uma entrada separada.
    expect(acha('pulldown')).toEqual(['e49', 'e50', 'e51', 'e120', 'e126']);
    expect(acha('lat pulldown')).toEqual(['e49', 'e120']);
    const e49 = EXERCISES.find((e) => e.id === 'e49')!;
    const e126 = EXERCISES.find((e) => e.id === 'e126')!;
    expect(e49.padraoMovimento).toBe('puxar');
    expect(e126.padraoMovimento).toBe('isolado');
    expect(e49.nomePt).not.toBe(e126.nomePt);
  });

  it('normalizarBusca só tira caixa e acento — não mexe em hífen nem espaço', () => {
    expect(normalizarBusca('Púxada-Alta ')).toBe('puxada-alta ');
  });
});

describe('🔎 ② as duas telas usam a MESMA busca', () => {
  const semComentarios = (p: string) => readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  const TELAS = [
    'src/components/painel/SeletorExercicio.tsx',
    'src/components/painel/RegistrarTreino.tsx',
  ];

  it('as duas importam e chamam `casaComBusca`', () => {
    for (const tela of TELAS) {
      const src = semComentarios(tela);
      expect(src, `${tela} não importa a fonte única da busca`).toMatch(/from '@\/lib\/busca-exercicio'/);
      expect(src, `${tela} não chama casaComBusca`).toMatch(/casaComBusca\(/);
    }
  });

  /**
   * 🔑 PAR DISCRIMINANTE: importar não basta — uma cópia local do `norm` ao lado da
   * importação é como as duas buscas divergiram. Nenhuma tela pode ter a sua própria.
   */
  it('nenhuma das duas mantém normalização/filtro de texto próprio', () => {
    for (const tela of TELAS) {
      const src = semComentarios(tela);
      expect(/const norm\s*=/.test(src), `${tela} voltou a ter um \`norm\` local`).toBe(false);
      expect(/normalize\('NFD'\)/.test(src), `${tela} normaliza texto por conta própria`).toBe(false);
    }
  });
});

describe('🔎 ③ a biblioteca distingue resultado de catálogo', () => {
  const src = readFileSync('src/components/painel/SeletorExercicio.tsx', 'utf8');

  it('a contagem mostra o resultado E o teto do fluxo, não só um número', () => {
    expect(src, 'a contagem voltou a ser um número solto').toMatch(/\$\{lista\.length\} de \$\{teto\}/);
    expect(src, 'o tamanho do catálogo recebido não é mostrado').toMatch(/\{exercises\.length\} do catálogo/);
  });

  it('o teto é derivado (nível + sem cardio), nunca um número escrito à mão', () => {
    const bloco = src.slice(src.indexOf('const teto = useMemo'), src.indexOf('/** Os filtros LIGADOS'));
    expect(bloco).toMatch(/dificuldadesLiberadas\(ctx\.nivelExperiencia\)/);
    expect(bloco).toMatch(/padraoMovimento !== 'cardio'/);
    expect(/\b16[0-9]\b/.test(bloco), 'contagem literal no código — vira mentira na próxima leva').toBe(false);
  });

  it('os filtros ativos são nomeados na tela e no estado vazio', () => {
    expect(src).toMatch(/const filtrosAtivos =/);
    expect(src, 'o estado vazio não diz quais filtros estavam combinando').toMatch(/Nenhum exercício combina com \{filtrosAtivos\.length/);
  });

  it('o chip que limpa o grupo diz que limpa o GRUPO (não promete o catálogo)', () => {
    expect(src).toMatch(/>Todos os grupos</);
  });
});
