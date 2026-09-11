/**
 * 🔴 R1 (revisão conjunta peso × registro, 2026-09-11) — REGRESSÃO DO COMPORTAMENTO CORRETO.
 *
 * O defeito: `aplicarPesoNoPerfil` lia o `perfil` CAPTURADO no render, e o callback de
 * `registrarPesoServidor` guardava essa função. Perfil 80 → registro otimista 81 → servidor
 * recusa e devolve 80: a comparação usava o 80 do closure, a função retornava antes de fazer
 * nada, e o perfil ficava 81 com o histórico 80. Quando o peso aceito diferia do capturado,
 * `{ ...perfil }` espalhava o perfil VELHO e podia desfazer edições feitas durante a espera.
 *
 * A reprodução original AFIRMAVA o defeito (`expect(atual.pesoKg).toBe(81)`). Aqui ela é a
 * afirmação do certo: o perfil converge para 80.
 *
 * Guard em cinco pernas:
 *  ① a reprodução exata, invertida — resposta atrasada CONVERGE;
 *  ② edição concorrente durante a espera sobrevive (nenhum campo antigo é restaurado);
 *  ③ unmount não escreve;
 *  ④ troca de conta descarta a resposta da conta antiga;
 *  ⑤ o Painel não voltou a ler o perfil do render nem a pôr efeito colateral em updater.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decidirPerfilAposResposta,
  reconciliarPerfilComPesoAceito,
  type ContextoResposta,
} from '../lib/peso-reconciliacao';

const HOJE = '2026-09-11';
const CONTA = 'user-a';
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const painel = () => readFileSync('src/components/painel/Painel.tsx', 'utf8');

type Perfil = { pesoKg: number; nome: string; alergenos: string[] };
const perfilBase: Perfil = { pesoKg: 80, nome: 'original', alergenos: [] };

/** Contexto "tudo em ordem": só o que cada teste muda é que decide o desfecho. */
const ctx = (over: Partial<ContextoResposta> = {}): ContextoResposta => ({
  pesoAceito: 80,
  diaDaResposta: HOJE,
  diaGovernante: HOJE,
  montado: true,
  contaDaChamada: CONTA,
  contaAgora: CONTA,
  ...over,
});

describe('🔴 R1 ① — a resposta atrasada converge contra o estado ATUAL', () => {
  it('perfil 80 → registro 81 → servidor devolve 80: o perfil volta a 80', () => {
    // O registro otimista já moveu o perfil para 81 (é o estado ATUAL quando a resposta chega).
    const depoisDoOtimista = reconciliarPerfilComPesoAceito(perfilBase, ctx({ pesoAceito: 81 }));
    expect(depoisDoOtimista.perfil?.pesoKg).toBe(81);

    // Resposta RECUSADO_DIA com 80 — no defeito, o closure de 80 fazia isto virar no-op.
    const aposRecusa = reconciliarPerfilComPesoAceito(depoisDoOtimista.perfil!, ctx({ pesoAceito: 80 }));
    expect(aposRecusa.motivo, 'a resposta foi descartada em vez de reconciliar').toBeNull();
    expect(aposRecusa.perfil?.pesoKg, 'perfil e histórico ficaram divergentes').toBe(80);
  });

  it('duas respostas em sequência compõem, em vez de a segunda ler a primeira desatualizada', () => {
    let atual: Perfil = perfilBase;
    for (const kg of [81, 80, 82]) {
      const r = reconciliarPerfilComPesoAceito(atual, ctx({ pesoAceito: kg }));
      if (r.perfil) atual = r.perfil;
    }
    expect(atual.pesoKg).toBe(82);
  });

  it('peso já igual ao do perfil não regrava nada (nem dispara persistência)', () => {
    const r = reconciliarPerfilComPesoAceito(perfilBase, ctx({ pesoAceito: 80 }));
    expect(r.motivo).toBe('JA_CONVERGIDO');
    expect(r.perfil).toBeNull();
  });
});

describe('🔴 R1 ② — edição concorrente durante a espera sobrevive', () => {
  it('só `pesoKg` muda: nome e alérgenos editados na espera NÃO voltam ao valor antigo', () => {
    // A pessoa registrou 81 e, enquanto a resposta não chegava, editou o perfil.
    const editadoNaEspera: Perfil = { pesoKg: 81, nome: 'editado na espera', alergenos: ['leite'] };
    const r = reconciliarPerfilComPesoAceito(editadoNaEspera, ctx({ pesoAceito: 80 }));
    expect(r.perfil).toEqual({ pesoKg: 80, nome: 'editado na espera', alergenos: ['leite'] });
  });

  it('a base é o perfil passado e o objeto original não é mutado', () => {
    const antes = { ...perfilBase };
    const r = reconciliarPerfilComPesoAceito(perfilBase, ctx({ pesoAceito: 82 }));
    expect(perfilBase, 'o perfil de entrada foi mutado').toEqual(antes);
    expect(r.perfil).not.toBe(perfilBase);
  });
});

describe('🔴 R1 ③④ — unmount e troca de conta descartam a resposta', () => {
  it('componente desmontado: nada é aplicado', () => {
    const r = reconciliarPerfilComPesoAceito(perfilBase, ctx({ pesoAceito: 81, montado: false }));
    expect(r).toEqual({ perfil: null, motivo: 'DESMONTADO' });
  });

  it('a conta trocou entre a ida e a volta: a resposta é de outra pessoa', () => {
    const r = reconciliarPerfilComPesoAceito(perfilBase, ctx({ pesoAceito: 81, contaAgora: 'user-b' }));
    expect(r).toEqual({ perfil: null, motivo: 'OUTRA_CONTA' });
  });

  it('logout no meio da espera (escopo virou null) também descarta', () => {
    const r = reconciliarPerfilComPesoAceito(perfilBase, ctx({ pesoAceito: 81, contaAgora: null }));
    expect(r.motivo).toBe('OUTRA_CONTA');
  });

  it('o desmonte é checado ANTES da conta e do valor: nenhuma resposta escapa', () => {
    const r = decidirPerfilAposResposta({
      ...ctx({ pesoAceito: null, montado: false, contaAgora: 'user-b' }),
      pesoDoPerfilAgora: 80,
    });
    expect(r).toEqual({ aplicar: false, motivo: 'DESMONTADO' });
  });
});

describe('🔴 R1 ⑤ — o Painel não pode voltar a capturar o perfil do render', () => {
  const fonte = semComentarios(painel());
  const corpo = (() => {
    const i = fonte.indexOf('function aplicarPesoNoPerfil(');
    expect(i, 'aplicarPesoNoPerfil desapareceu — o guard ficaria vazio').toBeGreaterThan(-1);
    return fonte.slice(i, fonte.indexOf('\n  }', i) + 4);
  })();

  it('lê o perfil por ref, não a variável de estado do render', () => {
    expect(corpo).toContain('perfilRef.current');
    expect(/\{\s*\.\.\.perfil\s*[,}]/.test(corpo), 'voltou a espalhar o perfil capturado').toBe(false);
    expect(/\bperfil\.pesoKg/.test(corpo), 'voltou a comparar com o perfil do render').toBe(false);
  });

  it('o ref é sincronizado de forma síncrona por onde toda mudança de perfil passa', () => {
    const i = fonte.indexOf('function notificarPerfil(');
    const notificar = fonte.slice(i, fonte.indexOf('\n  }', i) + 4);
    expect(notificar).toContain('perfilRef.current = novoPerfil');
  });

  it('nenhum efeito colateral dentro de updater do setState (React pode reexecutar)', () => {
    // A chamada é delimitada por parênteses BALANCEADOS — uma janela de N caracteres
    // atravessaria o fim do updater e acusaria o código seguinte.
    const ateFecharParenteses = (de: number) => {
      let n = 0;
      for (let i = fonte.indexOf('(', de); i < fonte.length; i += 1) {
        if (fonte[i] === '(') n += 1;
        else if (fonte[i] === ')') { n -= 1; if (n === 0) return fonte.slice(de, i + 1); }
      }
      return fonte.slice(de);
    };
    const updaters = [...fonte.matchAll(/set(?:Perfil|Pesos)\(\s*\(/g)];
    expect(updaters.length, 'a varredura não encontrou updater nenhum').toBeGreaterThan(0);
    for (const m of updaters) {
      const chamada = ateFecharParenteses(m.index!);
      for (const proibido of ['notificarPerfil(', 'registrarPesoServidor(', 'substituirPesos(', 'localStorage']) {
        expect(chamada.includes(proibido), `efeito colateral em updater: ${proibido}\n${chamada}`).toBe(false);
      }
    }
  });

  it('o painel guarda o sinal de vida e a conta da chamada', () => {
    expect(fonte).toContain('painelVivoRef');
    expect(fonte).toContain('contaLocalRef');
    expect(fonte).toContain('contaDaChamada');
  });
});
