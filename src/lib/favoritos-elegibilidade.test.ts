import { describe, expect, it } from 'vitest';
import { elegibilidadeFavorito, emPausaPorDor } from './favoritos-elegibilidade';
import { avaliarGateTreino, montarRotina, prescreverTreino } from '@/lib/engine';
import { EXERCISES } from '@/lib/data/exercises';
import type { PerfilTreino } from '@/lib/engine';
import type { SessaoHistorico } from '@/lib/treino-historico';

/**
 * Âncoras da DF B5 (2026-07-04) + refino V8.5: nível/dias/pausa fixos, copy verbatim do
 * cofre; o motivo de EQUIPAMENTO é dinâmico ("pede academia" / "pede {o que falta}").
 * Descompasso não é erro — o favorito continua na lista.
 */
const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfilT = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over });
const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;
const rotinaDe = (p: PerfilTreino, favs: string[] = []) => montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(favs));

const sessaoCom = (exId: string, pausado: boolean, dataISO: string, n: number): SessaoHistorico => ({
  dia: 'Treino', series: 3, volumeKg: 0, feedback: {}, n, dataISO,
  exercicios: [{ id: exId, nome: exId, loaded: false, fb: null, sets: [], ...(pausado ? { pausado: true } : {}) }],
});

describe('elegibilidadeFavorito — os 4 motivos travados (B5)', () => {
  it('equipamento (academia): e9 Supino p/ quem treina sem equipamento → "pede academia"', () => {
    const p = perfilT({ equipamento: 'nenhum' });
    const r = elegibilidadeFavorito(byId('e9'), p, rotinaDe(p));
    expect(r).toEqual({ elegivel: false, motivo: 'pede academia' });
  });

  it('equipamento (casa-com): motivo dinâmico = "pede {o que falta}" (V8.5)', () => {
    const casa = (equipamentosCasa: PerfilTreino['equipamentosCasa']) =>
      perfilT({ equipamento: 'casa', equipamentosCasa });
    // exigido simples: e22 Barra fixa
    expect(elegibilidadeFavorito(byId('e22'), casa([]), null).motivo).toBe('pede barra fixa');
    // exigido composto: e12 Supino inclinado (halteres + banco) — lista SÓ o que falta
    expect(elegibilidadeFavorito(byId('e12'), casa([]), null).motivo).toBe('pede halteres + banco');
    expect(elegibilidadeFavorito(byId('e12'), casa(['halteres']), null).motivo).toBe('pede banco');
    // any-of insatisfeito: e33 Goblet (halteres OU kettlebell) → cláusula "ou"
    expect(elegibilidadeFavorito(byId('e33'), casa([]), null).motivo).toBe('pede halteres ou kettlebell');
    // any-of satisfeito por QUALQUER um dos dois → elegível
    expect(elegibilidadeFavorito(byId('e33'), casa(['kettlebell']), null)).toEqual({ elegivel: true });
    expect(elegibilidadeFavorito(byId('e33'), casa(['halteres']), null)).toEqual({ elegivel: true });
  });

  it('nível: e26 Terra (avançado) favoritado por um iniciante', () => {
    const p = perfilT({ nivelExperiencia: 'iniciante', equipamento: 'academia' });
    const r = elegibilidadeFavorito(byId('e26'), p, rotinaDe(p));
    expect(r).toEqual({ elegivel: false, motivo: 'é de um nível acima do seu atual' });
  });

  it('dias: passa os filtros mas não entrou em nenhum slot da semana', () => {
    const p = perfilT();
    const rotina = rotinaDe(p);
    // acha um exercício elegível (equip+nível ok) que NÃO está na rotina montada
    const noPlano = new Set(rotina.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id)));
    const fora = EXERCISES.find((e) => !noPlano.has(e.id) && e.local !== 'casa_com' && e.nivel !== 'avancado' && e.padraoMovimento === 'isolado')!;
    const r = elegibilidadeFavorito(fora, p, rotina);
    expect(r).toEqual({ elegivel: false, motivo: 'não coube nos seus dias de treino' });
  });

  it('pausa por dor: ocorrência mais recente pausada → motivo; sessão nova sem pausa limpa', () => {
    const p = perfilT();
    const rotina = rotinaDe(p, ['e9']);
    const histPausado = [sessaoCom('e9', true, '2026-07-02', 2), sessaoCom('e9', false, '2026-07-01', 1)];
    expect(emPausaPorDor('e9', histPausado)).toBe(true);
    expect(elegibilidadeFavorito(byId('e9'), p, rotina, histPausado)).toEqual({ elegivel: false, motivo: 'em pausa por dor' });
    // treinou de novo sem pausar → volta a ser elegível
    const histLimpo = [sessaoCom('e9', false, '2026-07-03', 3), ...histPausado];
    expect(emPausaPorDor('e9', histLimpo)).toBe(false);
    expect(elegibilidadeFavorito(byId('e9'), p, rotina, histLimpo).elegivel).toBe(true);
  });

  it('favorito que entrou no plano → elegível (sem motivo)', () => {
    const p = perfilT();
    const rotina = rotinaDe(p, ['e9']);
    expect(elegibilidadeFavorito(byId('e9'), p, rotina)).toEqual({ elegivel: true });
  });
});
