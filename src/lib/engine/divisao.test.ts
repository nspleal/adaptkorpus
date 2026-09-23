import { verificarDistribuicaoComplementares } from './__fixtures__/complementares-contrato';
/**
 * 🎛️ v4 · DF③ (2026-08-12) — a DIVISÃO como escolha do usuário (leva B2 do
 * handoff-motor-volume-v4). `auto` = padrão por dias · `superior-inferior` força Sup/Inf
 * onde os dias permitem · `prioridades` monta dias por tema (template travado: 4 dias).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { templatesDaSemana } from './alocador';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';
import { MINIMOS_TEMPO } from './adequacao-tempo-politica';
import { avaliarDuracaoResistida } from './duracao-plano';
import { creditoPonderadoDaSemana } from './alocador';
import { GRUPOS_COM_FAIXA_SEMANAL } from './grupos-volume';
import { tetoSemanalDoGrupo } from './trilhos';
import { distribuirGruposNoCalendario } from './calendario-grupos';
import { ORDEM_SEMANA } from '../semana';
import { selecionarDivisao } from './selecao-divisao';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...over,
});
const plano = (p: PerfilTreino) => montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 3 });

describe('🎛️ DF③ — as três divisões', () => {
  it.each([
    {nivelExperiencia:'iniciante' as const,tempoPorSessaoMin:20},
    {nivelExperiencia:'intermediario' as const,tempoPorSessaoMin:30},
  ])('$nivelExperiencia/7d/$tempoPorSessaoMin: o corte temporal preserva os papéis necessários à estabilidade',over=>{
    const p=perfil({...over,diasDisponiveis:7});
    const rs=([1,2,3,4,5] as const).map(semana=>montarRotina(
      prescreverTreino(p,avaliarGateTreino(p)),p,EXERCISES,new Set(),{semana}));
    const ids=(r:typeof rs[number])=>r.dias.map(d=>d.slots.map(s=>s.exercicio.id));
    for(const r of rs){
      expect(r.resultadoGeracao).toMatchObject({tipo:'CERTIFICADO'});
      expect(r.dias).toHaveLength(7);
      expect(ids(r)).toEqual(ids(rs[0]!));
      for(const d of r.dias)expect(avaliarDuracaoResistida(d.slots,p.nivelExperiencia)
        .duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(p.tempoPorSessaoMin*60);
    }
  });
  it.each([4,5,6,7])('%i dias: seleção automática estruturada independe do nível; escolha explícita continua preservada',diasDisponiveis=>{
    const selecoes=(['iniciante','intermediario','avancado'] as const).map(nivelExperiencia=>{
      const p=perfil({diasDisponiveis,nivelExperiencia});
      const legado=templatesDaSemana(diasDisponiveis,nivelExperiencia);
      expect(selecionarDivisao(legado,{...p,divisaoPreferida:'superior-inferior'},undefined,false)).toEqual(legado);
      return selecionarDivisao(legado,p,undefined,false);
    });
    expect(selecoes[0]).toEqual(selecoes[1]);expect(selecoes[1]).toEqual(selecoes[2]);
    expect(selecoes[0]!.intencao!.adaptada).toBe(false);
    expect(selecoes[0]!.dias).toHaveLength(diasDisponiveis);
  });
  it('as 35 agendas de três dias conservam a alternância, inclusive domingo → segunda',()=>{
    for(let a=0;a<5;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<7;c++)for(const semana of [1,2]){
      const agenda=[ORDEM_SEMANA[a]!,ORDEM_SEMANA[b]!,ORDEM_SEMANA[c]!];
      const t=templatesDaSemana(3,'intermediario','auto',semana);
      const r=distribuirGruposNoCalendario(t.dias,agenda,[],2,true,true);
      expect(r.limitado).toBe(false);
      expect(r.dias.map(d=>d.nome)).toEqual(t.dias.map(d=>d.nome));
      for(const [i,d] of r.dias.entries()){
        const tipo=d.nome.startsWith('Upper')?'upper':'lower';
        for(const g of Object.keys(MINIMOS_TEMPO[tipo]))expect(d.grupos,`${agenda}/${semana}/${i}`).toContain(g);
      }
    }
  });
  it.each((['iniciante', 'intermediario', 'avancado'] as const).flatMap(nivel=>[60,90].map(tempo=>({nivel,tempo}))))('$nivel/$tempo min: três dias alternam Upper/Lower, com mínimos e composição estável por alternância', ({nivel:nivelExperiencia,tempo}) => {
    const p = perfil({nivelExperiencia, tempoPorSessaoMin:tempo, diasDisponiveis: 3, treinoDias: ['seg','qua','sex']});
    const gerar = (semana: 1|2|3|4|5|6) => montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), {semana});
    const rs = ([1,2,3,4,5,6] as const).map(gerar);
    const ids = (r: typeof rs[number]) => r.dias.map(d=>({dia:d.diaId,ids:d.slots.map(s=>s.exercicio.id).sort()}));
    for (const [i,r] of rs.entries()) {
      const tipos = i % 2 === 0 ? ['upper','lower','upper'] as const : ['lower','upper','lower'] as const;
      expect(r.split).toBe(i % 2 === 0 ? 'Upper / Lower / Upper' : 'Lower / Upper / Lower');
      expect(r.resultadoGeracao, JSON.stringify(r.resultadoGeracao)).toMatchObject({tipo:'CERTIFICADO'});
      expect(r.dias.map(d=>d.diaId)).toEqual(['seg','qua','sex']);
      expect(ids(r)).toEqual(ids(rs[i % 2]!));
      for (const [j,d] of r.dias.entries()) {
        expect(d.nome.toLowerCase().startsWith(tipos[j]!)).toBe(true);
        for (const [g,min] of Object.entries(MINIMOS_TEMPO[tipos[j]!]))
          expect(d.slots.filter(s=>s.exercicio.grupoPrimario===g).length,`${d.nome}/${g}`).toBeGreaterThanOrEqual(min);
        const proibidos = tipos[j]==='upper' ? ['quadriceps','posterior','gluteos'] : ['peito','costas','ombros','biceps','triceps'];
        expect(d.slots.some(s=>proibidos.includes(s.exercicio.grupoPrimario!))).toBe(false);
        expect(d.slots.every(s=>(s.series??0)>=1&&(s.descansoSeg??0)>=60)).toBe(true);
        expect(avaliarDuracaoResistida(d.slots,nivelExperiencia).duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(tempo*60);
        for(const v of creditoPonderadoDaSemana(d.slots).values())expect(v).toBeLessThanOrEqual(r.tetoVolumeSemana!.sessao!);
      }
      const t=r.tetoVolumeSemana!;
      const teto=tetoSemanalDoGrupo({nivel:nivelExperiencia,objetivo:p.objetivo,emFoco:t.gruposEmFoco,tetoDaFase:t.cheio});
      const creditos=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
      for(const g of GRUPOS_COM_FAIXA_SEMANAL)expect(creditos.get(g)??0,g).toBeLessThanOrEqual(teto(g));
    }
    expect(gerar(1)).toEqual(rs[0]); // a memo par não contamina a ímpar
    for(const [i,d] of rs[5]!.dias.entries())for(const s of d.slots)
      expect(s.series).toBeLessThanOrEqual(rs[3]!.dias[i]!.slots.find(x=>x.exercicio.id===s.exercicio.id)!.series!);
  });

  it('ausente ≡ auto: o plano é byte-idêntico (ninguém ganha divisão que não pediu)', () => {
    const sem = JSON.stringify(plano(perfil()));
    const auto = JSON.stringify(plano(perfil({ divisaoPreferida: 'auto' })));
    expect(auto).toBe(sem);
  });

  it('superior-inferior é preferência: calendário pode reagrupar; 1 dia é full-body', () => {
    expect(plano(perfil({ divisaoPreferida: 'superior-inferior', diasDisponiveis: 2 })).split).toBe('Upper / Lower');
    expect(plano(perfil({ divisaoPreferida: 'superior-inferior', diasDisponiveis: 3 })).split).toBe('Upper / Lower / Upper');
    expect(plano(perfil({ divisaoPreferida: 'superior-inferior', diasDisponiveis: 5, nivelExperiencia: 'avancado' })).split).toBe('Distribuição pela agenda');
    expect(plano(perfil({ divisaoPreferida: 'superior-inferior', diasDisponiveis: 1 })).split).toBe('Full-body');
  });

  it('prioridades mantém braços sem preencher o orçamento por quota de exercícios', () => {
    const r = plano(perfil({ divisaoPreferida: 'prioridades' }));
    expect(r.split).toBe('Prioridades (4 dias)');
    const bracos = r.dias.find((d) => d.nome === 'Braços + Core');
    expect(bracos, 'o dia de braços não existe').toBeDefined();
    const conta = (g: string) => bracos!.slots.filter((s) => s.exercicio.grupoPrimario === g).length;
    expect(conta('biceps'), `bíceps no dia de braços: ${conta('biceps')}`).toBeGreaterThanOrEqual(1);
    expect(conta('biceps')).toBeLessThanOrEqual(3);
    expect(conta('triceps'), `tríceps no dia de braços: ${conta('triceps')}`).toBeGreaterThanOrEqual(1);
    expect(conta('triceps')).toBeLessThanOrEqual(5); // teto vigente das prioridades, sem quota por sessão
  });

  it('prioridades: as invariantes seguem de pé (core 2–3× · puxar ≥ empurrar · dobradiça)', () => {
    const r = plano(perfil({ divisaoPreferida: 'prioridades' }));
    const contaPadrao = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
    // Autor 19/09: localização e um complementar por dia precedem core 2x.
    verificarDistribuicaoComplementares(r);
    expect(contaPadrao('puxar')).toBeGreaterThanOrEqual(contaPadrao('empurrar'));
    expect(contaPadrao('dobradica_quadril')).toBeGreaterThanOrEqual(1);
  });

  it('prioridades fora de 4 dias cai no padrão por dias (template travado só p/ 4 — declarado)', () => {
    for (const dias of [2, 3, 5]) {
      const auto = plano(perfil({ diasDisponiveis: dias, nivelExperiencia: 'avancado' })).split;
      expect(plano(perfil({ divisaoPreferida: 'prioridades', diasDisponiveis: dias, nivelExperiencia: 'avancado' })).split).toBe(auto);
    }
  });

  it('os templates são dados fechados: toda divisão × 1–6 dias resolve sem grupo fora do vocabulário', () => {
    const GRUPOS = new Set(['antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar', 'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps']);
    for (const divisao of ['auto', 'superior-inferior', 'prioridades'] as const) {
      for (const dias of [1, 2, 3, 4, 5, 6]) {
        for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
          const { dias: templates } = templatesDaSemana(dias, nivel, divisao);
          expect(templates).toHaveLength(dias);
          for (const t of templates) for (const g of t.grupos) expect(GRUPOS.has(g), `${divisao}/${dias}d: grupo desconhecido ${g}`).toBe(true);
        }
      }
    }
  });
});

/**
 * 🔒 DESCOBRIBILIDADE (a regra de 2026-08-08, aplicada de novo): o seletor RENDERIZA no
 * Editar perfil, sem condicional — controle atrás de condição some em silêncio.
 */
describe('🔒 a divisão tem porta encontrável', () => {
  const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

  it('o Editar perfil monta o seletor, fora de condicional, e grava no salvar', () => {
    const editar = fonte('src/components/painel/EditarPerfil.tsx');
    const i = editar.indexOf('<SeletorDivisao');
    expect(i, 'o seletor não é montado no Editar perfil').toBeGreaterThan(-1);
    const antes = editar.slice(Math.max(0, i - 60), i).trimEnd();
    expect(antes.endsWith('&&') || antes.endsWith('?'), 'o seletor está atrás de condição').toBe(false);
    expect(editar).toMatch(/divisaoPreferida: divisao === 'auto' \? undefined : divisao/);
  });

  it('a copy do seletor declara o limite do prioridades (4 dias) em vez de fingir', () => {
    const favs = fonte('src/components/painel/Favoritos.tsx');
    const i = favs.indexOf('export function SeletorDivisao');
    expect(i).toBeGreaterThan(-1);
    expect(favs.slice(i, i + 2600)).toMatch(/Vale com 4 dias/);
  });
});
