/**
 * 🔒 C1 — CAS na camada de aplicação/repositório (decisão do autor "Escolha A"). Prova a semântica
 * do compare-and-swap com o adaptador de memória: os quatro estados discriminados, a precedência
 * dos erros, e o TESTE MÍNIMO OBRIGATÓRIO dos dois escritores partindo da mesma revisão.
 */
import { describe, expect, it } from 'vitest';
import { canonicalInputHash, decidirPreCommit, type ComandoCommit } from '@/lib/engine/cas';
import { persistirPlanoComCAS, RepositorioMemoria } from './plano-cas';

const FV = 'tempo-v1'; // formulaVersion vigente nos testes
const AID = 'user-1:plano';

function comando(over: Partial<ComandoCommit<{ n: number }>> = {}): ComandoCommit<{ n: number }> {
  return {
    aggregateId: AID,
    expectedRevision: 7,
    formulaVersion: FV,
    canonicalInputHash: canonicalInputHash({ perfil: 'x' }),
    aggregate: { n: 1 },
    ...over,
  };
}

// ── Núcleo puro: hash determinístico ───────────────────────────────────────────
describe('CAS · canonicalInputHash (puro, determinístico)', () => {
  it('mesma entrada → mesmo hash; ordem de chaves não importa', () => {
    const a = canonicalInputHash({ x: 1, y: 2 });
    const b = canonicalInputHash({ y: 2, x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it('entradas diferentes → hashes diferentes', () => {
    expect(canonicalInputHash({ x: 1 })).not.toBe(canonicalInputHash({ x: 2 }));
  });
  it('usa SHA-256 UTF-8: vetor conhecido e textos Unicode distintos não colidem', () => {
    expect(canonicalInputHash({ x: 'abc' })).toBe('270012bdffcdc54c226ac7d3bcc965b48e8c688c39b78313e40c82d96cda2dd4');
    // Vetor UTF-8 independente: evita regressão para bytes UTF-16 e a colisão anterior.
    expect(canonicalInputHash({ x: 'é' })).toBe('97f06f396a709c3a29824e1cc794eeb98e2d1a262d7d455439d286d42803f0fe');
    expect(canonicalInputHash({ alergenos: ['℡'] })).not.toBe(canonicalInputHash({ alergenos: ['!!'] }));
  });
});

// ── Núcleo puro: precedência dos erros ─────────────────────────────────────────
describe('CAS · decidirPreCommit (precedência versão/hash → revisão)', () => {
  const atual = { revision: 7, formulaVersion: FV, canonicalInputHash: canonicalInputHash({ perfil: 'x' }) };

  it('VERSAO obsoleta é rejeitada ANTES da revisão (nunca persistir motor obsoleto)', () => {
    const r = decidirPreCommit(atual, comando({ formulaVersion: 'tempo-v0', expectedRevision: 999 }), FV);
    expect(r.tipo).toBe('CONFLITO_VERSAO_OU_HASH');
    expect(r).toMatchObject({ motivo: 'VERSAO' });
  });

  it('HASH malformado/vazio é rejeitado (sem certificado de input não persiste)', () => {
    const r = decidirPreCommit(atual, comando({ canonicalInputHash: '' }), FV);
    expect(r).toMatchObject({ tipo: 'CONFLITO_VERSAO_OU_HASH', motivo: 'HASH' });
  });
  it('hash legado de 16 caracteres é rejeitado; o certificado SHA-256 precisa estar completo', () => {
    const r = decidirPreCommit(atual, comando({ canonicalInputHash: '0123456789abcdef' }), FV);
    expect(r).toMatchObject({ tipo: 'CONFLITO_VERSAO_OU_HASH', motivo: 'HASH' });
  });

  it('revisão divergente ⇒ CONFLITO_REVISAO', () => {
    const r = decidirPreCommit(atual, comando({ expectedRevision: 6 }), FV);
    expect(r).toMatchObject({ tipo: 'CONFLITO_REVISAO', revisaoEsperada: 6, revisaoAtual: 7 });
  });

  it('tudo bate ⇒ PROSSEGUIR para a próxima revisão', () => {
    const r = decidirPreCommit(atual, comando({ expectedRevision: 7 }), FV);
    expect(r).toMatchObject({ tipo: 'PROSSEGUIR', proximaRevision: 8 });
  });

  it('agregado inédito (snapshot null) parte da revisão 0', () => {
    const r = decidirPreCommit(null, comando({ expectedRevision: 0 }), FV);
    expect(r).toMatchObject({ tipo: 'PROSSEGUIR', proximaRevision: 1 });
  });
});

// ── Serviço + adaptador: os quatro estados ─────────────────────────────────────
describe('CAS · serviço de aplicação + repositório (troca atômica)', () => {
  function repoNaRevisao7() {
    return new RepositorioMemoria<{ n: number }>({
      aggregateId: AID, revision: 7, formulaVersion: FV,
      canonicalInputHash: canonicalInputHash({ perfil: 'x' }), aggregate: { n: 0 },
    });
  }

  it('COMMIT_CONFIRMADO produz a revisão seguinte e grava o agregado', async () => {
    const repo = repoNaRevisao7();
    const r = await persistirPlanoComCAS(repo, comando({ expectedRevision: 7, aggregate: { n: 42 } }), FV);
    expect(r).toMatchObject({ tipo: 'COMMIT_CONFIRMADO', revision: 8 });
    const snap = await repo.carregarSnapshot(AID);
    expect(snap!.revision).toBe(8);
  });

  it('FALHA_ATOMICA quando a troca não confirma por infra (não por revisão)', async () => {
    const repo = repoNaRevisao7();
    repo.programarFalhaAtomica();
    const r = await persistirPlanoComCAS(repo, comando({ expectedRevision: 7 }), FV);
    expect(r.tipo).toBe('FALHA_ATOMICA');
    // nada mudou: continua na revisão 7
    expect((await repo.carregarSnapshot(AID))!.revision).toBe(7);
  });
});

// ── TESTE MÍNIMO OBRIGATÓRIO: dois escritores partindo da revisão 7 ─────────────
describe('CAS · dois escritores partem da revisão 7 (teste mínimo obrigatório do autor)', () => {
  it('1º confirma (→8); 2º recebe CONFLITO_REVISAO, não persiste; retry recarrega 8 e recomputa', async () => {
    const repo = new RepositorioMemoria<{ n: number }>({
      aggregateId: AID, revision: 7, formulaVersion: FV,
      canonicalInputHash: canonicalInputHash({ perfil: 'v7' }), aggregate: { n: 7 },
    });

    // ① os dois LEEM a revisão 7
    const lidoA = (await repo.carregarSnapshot(AID))!.revision;
    const lidoB = (await repo.carregarSnapshot(AID))!.revision;
    expect(lidoA).toBe(7);
    expect(lidoB).toBe(7);

    // ② o PRIMEIRO confirma e produz a revisão 8
    const cmdA = comando({ expectedRevision: lidoA, aggregate: { n: 8 } });
    const rA = await persistirPlanoComCAS(repo, cmdA, FV);
    expect(rA).toMatchObject({ tipo: 'COMMIT_CONFIRMADO', revision: 8 });

    // ③ o SEGUNDO (ainda com a revisão 7) recebe CONFLITO_REVISAO
    const cmdB = comando({ expectedRevision: lidoB, aggregate: { n: 999 } });
    const rB = await persistirPlanoComCAS(repo, cmdB, FV);
    expect(rB).toMatchObject({ tipo: 'CONFLITO_REVISAO', revisaoEsperada: 7, revisaoAtual: 8 });

    // ④ o segundo NÃO persistiu nada: o agregado no banco é o do primeiro (n=8), não o obsoleto (n=999)
    const snap = await repo.carregarSnapshot(AID);
    expect(snap!.revision).toBe(8);

    // ⑤ nenhum resultado obsoleto é entregue como certificado — rB não é COMMIT_CONFIRMADO
    expect(rB.tipo).not.toBe('COMMIT_CONFIRMADO');

    // ⑥ nova tentativa: recarrega a revisão 8 e RECOMPUTA sobre ela (não reaplica o agregado obsoleto)
    const revAtual = (await repo.carregarSnapshot(AID))!.revision;
    expect(revAtual).toBe(8);
    const cmdBretry = comando({ expectedRevision: revAtual, aggregate: { n: 8_000 } }); // recomputado sobre a base nova
    const rBretry = await persistirPlanoComCAS(repo, cmdBretry, FV);
    expect(rBretry).toMatchObject({ tipo: 'COMMIT_CONFIRMADO', revision: 9 });
  });
});
