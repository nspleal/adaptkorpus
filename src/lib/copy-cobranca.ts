/**
 * 🔒 O NÚCLEO DA AFIRMAÇÃO SOBRE DINHEIRO (DF 2026-08-01, `faq-evokorpus`
 * §Assinatura, preço e cancelamento).
 *
 * 🔴 O defeito que isto fecha, medido: *"quanto custa?"* é respondida em **três** telas —
 * `/faq`, landing e `/suporte` — e cada uma tinha **um texto diferente**. O conteúdo
 * concordava; a forma divergia. **Três lugares livres derivam sozinhos**, e quando derivam
 * ninguém descobre qual dos três envelheceu.
 *
 * 🔑 A separação travada: **o que não pode variar é a afirmação sobre dinheiro**; o
 * complemento varia porque a superfície varia (marketing × referência × operação). Por isso
 * o núcleo mora aqui, uma vez só, e os complementos ficam declarados e livres.
 *
 * ⚠️ Este módulo é copy, não regra de motor — mas vale a mesma trava do beta: **não existe
 * cobrança, checkout nem assinatura no app**. Qualquer frase daqui que passe a descrever
 * mecanismo operante é o defeito de volta (`honestidade-tela.test.ts`).
 */

/** 🔒 Literal e IDÊNTICO nas três superfícies. Não editar sem DF. */
export const NUCLEO_COBRANCA = 'Nada. O beta é gratuito: não existe cobrança nem assinatura hoje.';

/**
 * A resposta completa por superfície: núcleo travado + complemento livre.
 *
 * 🔑 Os complementos são **declarados**, não improvisados: `/faq` é referência (fala do
 * ebook e do checkout que não existe), a landing é entrada (fala do convite e do futuro),
 * `/suporte` é operação (só o convite).
 */
export const QUANTO_CUSTA = {
  faq: `${NUCLEO_COBRANCA} O ebook "A Curva" é R$ 27, compra única e separada — e o checkout dele ainda não está no ar.`,
  landing: `${NUCLEO_COBRANCA} As vagas são por convite. Se um plano pago existir no futuro, você decide se entra.`,
  suporte: `${NUCLEO_COBRANCA} As vagas são por convite.`,
} as const;

export type SuperficieCobranca = keyof typeof QUANTO_CUSTA;
