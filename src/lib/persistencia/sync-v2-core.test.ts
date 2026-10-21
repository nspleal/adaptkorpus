import { describe, it, expect } from 'vitest';
import { mesclarTresVias } from './mescla';
import { promoverDefinicaoTreino, desfazerDefinicaoTreino, restaurarDefinicaoTreino, extrairDefinicaoTreino } from './treino-versoes';
import type { PerfilResumo } from '@/components/painel/Painel';

describe('contratos da estrutura editável', () => {
  it('aplicar → desfazer → aplicar mantém só atual + anterior, sem modificar os fatos atuais', () => {
    const inicial = { atual: { id: 'a', definicao: { tempoPorSessaoMin: 40 } } };
    const b = promoverDefinicaoTreino(inicial, { id: 'b', definicao: { tempoPorSessaoMin: 50 } });
    expect(b.tipo).toBe('CONFIRMADO'); if (b.tipo === 'CONFLITO_ALVO') return;
    const undo = desfazerDefinicaoTreino(b.versoes, 'a', 'u');
    if (undo.tipo === 'CONFLITO_ALVO') throw new Error('undo rejeitado');
    expect(undo.versoes.atual.definicao.tempoPorSessaoMin).toBe(40);
    expect(undo.versoes.anterior?.id).toBe('b');
    const c = promoverDefinicaoTreino(undo.versoes, { id: 'c', definicao: { tempoPorSessaoMin: 60 } });
    if (c.tipo === 'CONFLITO_ALVO') throw new Error('apply rejeitado');
    expect(c.versoes.anterior?.id).toBe('u');
    expect(JSON.stringify(c)).not.toContain('"id":"a"');
    const perfil = { pesoKg: 82, mesocicloInicio: '2026-10-18', tempoPorSessaoMin: 60 } as PerfilResumo;
    const restaurado = restaurarDefinicaoTreino(perfil, undo.versoes.atual.definicao);
    expect(restaurado).toMatchObject({ pesoKg: 82, mesocicloInicio: '2026-10-18', tempoPorSessaoMin: 40 });
    expect(extrairDefinicaoTreino(perfil)).not.toHaveProperty('pesoKg');
  });
  it('no-op não gira e alvo antigo não é substituído silenciosamente', () => {
    const v = { atual: { id: 'b', definicao: { tempoPorSessaoMin: 50 } }, anterior: { id: 'a', definicao: { tempoPorSessaoMin: 40 } } };
    expect(promoverDefinicaoTreino(v, { id: 'c', definicao: { tempoPorSessaoMin: 50 } })).toEqual({ tipo: 'SEM_MUDANCA', versoes: v });
    expect(desfazerDefinicaoTreino(v, 'outro', 'u')).toEqual({ tipo: 'CONFLITO_ALVO' });
  });
});
describe('mescla de três vias', () => {
  it('combina campos e dias independentes; conflito no mesmo campo exige escolha', () => {
    expect(mesclarTresVias({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 2 })).toEqual({ valor: { a: 2, b: 2 }, conflitos: [] });
    expect(mesclarTresVias({ a: 1 }, { a: 2 }, { a: 3 }).conflitos).toEqual(['/a']);
    const base = { rotinaCustom: { dias: [{ diaId: 'seg', nome: 'A' }, { diaId: 'ter', nome: 'B' }] } };
    const local = structuredClone(base), remoto = structuredClone(base);
    local.rotinaCustom.dias[0]!.nome = 'A2'; remoto.rotinaCustom.dias[1]!.nome = 'B2';
    expect(mesclarTresVias(base, local, remoto)).toMatchObject({ conflitos: [], valor: { rotinaCustom: { dias: [{ nome: 'A2' }, { nome: 'B2' }] } } });
  });
  it('não confunde remoção com null, nem reordenação com identidade', () => {
    expect(mesclarTresVias({ a: 1 }, {}, { a: 2 }).conflitos).toEqual(['/a']);
    expect(mesclarTresVias({ a: 1, b: 1 }, { b: 1 }, { a: 1, b: 2 }).valor).toEqual({ b: 2 });
    expect(mesclarTresVias([1, 2], [2, 1], [1, 3]).conflitos).toEqual(['/']);
  });
});
