import { describe, expect, it } from 'vitest';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import { gerarTreino } from './engine';
import { EXERCISES } from './data/exercises';
import { seriesEmDeload } from './engine/treino';
import type { PerfilTreino, RotinaCustom, RotinaSemanal } from './engine/treino-types';
import type { OpcoesSemana } from './engine/treino-montador';

const base: PerfilTreino = { pesoKg:80, alturaCm:180, idade:30, flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}, objetivo:'massa',nivelExperiencia:'avancado',equipamento:'academia',diasDisponiveis:3,treinoDias:['seg','ter','qua'],tempoPorSessaoMin:60,limiteTempoTreino:'sem_limite',foco:{grupo:'peito',semana:1} };
// O nível avançado mantém e21 elegível nos desenhos manuais.
// O controle positivo de extras declara seu próprio perfil medido abaixo.
const gerar = (p: PerfilTreino, semanaCiclo: OpcoesSemana) => gerarTreino(p,{exercises:EXERCISES,semanaCiclo}).rotina!;
const dose = (r: RotinaSemanal) => r.dias.map(d=>({day:d.diaId,slots:d.slots.map(s=>[s.exercicio.id,s.series])}));
const abrir = (r:RotinaSemanal,p:PerfilTreino) => doPlano(r.dias,p.treinoDias??[],p.rotinaCustom);
const json = <T,>(v:T):T => JSON.parse(JSON.stringify(v));

describe('Transferência do plano ao editor conserva dose e intenção',()=>{
  it.each([20,30,60,75])('automático limitado %s min: abrir/cancelar, salvar/reabrir preservam cada slot',tempo=>{
    const p={...base,tempoPorSessaoMin:tempo,...(tempo<40?{diasDisponiveis:1,treinoDias:['seg'] as const}:{})};
    const r=gerar(p,{semana:1}),original=json({p,r});
    const draft=abrir(r,p);const manual=paraRotinaCustom(draft);
    const preview=gerar({...p,rotinaCustom:manual},{semana:1});
    expect(dose(preview)).toEqual(dose(r));
    expect({p,r}).toEqual(original); // abrir/calcular/cancelar não escreve o perfil/plano.
    const saved={...p,rotinaCustom:json(manual)};
    const loaded=gerar(saved,{semana:1});
    expect(dose(loaded)).toEqual(dose(r));
    expect(paraRotinaCustom(abrir(loaded,saved))).toEqual(manual);
  });
  it('anti-vacuidade: extras de duas séries e cortes de uma/duas chegam à prévia',()=>{
    // Três dias agora usam Upper/Lower. O controle positivo de foco é explícito,
    // sem mudar o nível avançado dos desenhos manuais dos demais casos.
    const p: PerfilTreino = {...base,nivelExperiencia:'intermediario',diasDisponiveis:4,treinoDias:['seg','ter','qui','sex'],tempoPorSessaoMin:90};
    const r=gerar(p,{semana:1});expect(r.blocoFoco!.adicionais).toHaveLength(2);
    expect(r.blocoFoco!.adicionais.map(s=>s.series)).toEqual([2,2]);
    const salvo = json(paraRotinaCustom(abrir(r,p)));
    expect(dose(gerar({...p,rotinaCustom:salvo},{semana:1}))).toEqual(dose(r));
    // 🔒 O corte por tempo só existe com limite declarado — o perfil-base agora é `sem_limite`
    // (é o que faz o bloco do foco caber), então o caso do CORTE declara o seu próprio.
    const curto=gerar({...base,limiteTempoTreino:'limitado',tempoPorSessaoMin:20,diasDisponiveis:1,treinoDias:['seg']},{semana:1});
    expect(new Set(curto.dias.flatMap(d=>d.slots.map(s=>s.series)))).toEqual(new Set([1,2]));
  });
  it.each(['limitado','sem_limite'] as const)('deload %s: uma redução, referência real após cortes, sem vazamento persistente',limiteTempoTreino=>{
    const p={...base,limiteTempoTreino,tempoPorSessaoMin:30,diasDisponiveis:1,treinoDias:['seg'] as const};
    const normal=gerar(p,{semana:5}),rec=gerar(p,{semana:6});
    for(const d of rec.dias)for(const s of d.slots){
      const n=normal.dias.find(x=>x.diaId===d.diaId)!.slots.find(x=>x.exercicio.id===s.exercicio.id)!;
      expect(s.seriesAntesDoDeload).toBe(n.series);
      expect(s.series).toBe(seriesEmDeload(n.series!));
    }
    const custom=json(paraRotinaCustom(abrir(rec,p)));expect(JSON.stringify(custom)).not.toContain('seriesAntesDoDeload');
    const saved={...p,rotinaCustom:custom};const preview=gerar(saved,{semana:6});
    expect(dose(preview)).toEqual(dose(rec));
    expect(paraRotinaCustom(abrir(preview,saved))).toEqual(custom);
    // Na volta à semana normal, dose por identidade é a propriedade. A ordem manual
    // salva no deload não precisa imitar a ordem automática da semana 5.
    const dosePorId = (r: RotinaSemanal) => dose(r).map(d => ({...d, slots: [...d.slots].sort((a,b) => String(a[0]).localeCompare(String(b[0])))}));
    expect(dosePorId(gerar(saved,{semana:1}))).toEqual(dosePorId(normal));
  });
  it.each([false,true])('custom existente, escolhas explícitas=%s: rampa/deload/retomada não congelam nem apagam intenção',explicit=>{
    const custom:RotinaCustom={origem:'usuario',dias:[{nome:'Meu',diaId:'seg',exercicioIds:['e1','e21','e19'],...(explicit?{seriesPorExercicio:{e1:7,e19:1}}:{})}]};
    const p={...base,rotinaCustom:custom,treinoDias:['seg'] as const,diasDisponiveis:1};
    for(const ctx of [{semana:1},{semana:5},{semana:6},{semana:3,retomada:{semana:1,fator:0.5,volumeReferencia:12}}] as OpcoesSemana[]){
      const r=gerar(p,ctx),draft=abrir(r,p),saved=paraRotinaCustom(draft);
      expect(saved).toEqual(custom);
      expect(dose(gerar({...p,rotinaCustom:json(saved)},ctx))).toEqual(dose(r));
      if(explicit){draft[0]!.seriesPorExercicio!.e1=9;expect(custom.dias[0]!.seriesPorExercicio!.e1).toBe(7);}
      else expect(draft[0]!.seriesPorExercicio).toEqual({});
    }
  });
  it('conversão durante retomada aplica teto sem multiplicar novamente a dose',()=>{
    const p={...base,treinoDias:['dom','seg'] as const,diasDisponiveis:2,tempoPorSessaoMin:30};
    const ctx:OpcoesSemana={semana:3,retomada:{semana:1,fator:0.5,volumeReferencia:12}};
    const r=gerar(p,ctx),custom=paraRotinaCustom(abrir(r,p)),saved={...p,rotinaCustom:custom};
    expect(dose(gerar(saved,ctx))).toEqual(dose(r));
    expect(paraRotinaCustom(abrir(gerar(saved,ctx),saved))).toEqual(custom);
    expect(r.blocoFoco?.adicionais??[]).toEqual([]);
  });
});
