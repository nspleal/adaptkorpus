import React from 'react';

/** Visível inclusive sem prescrição; explica a recuperação parcial antes do treino. */
export default function AvisosHidratacao({ avisos }: { avisos?: readonly string[] }) {
  if (!avisos?.length) return null;
  return (
    <section aria-label="Recuperação das suas preferências" role="status"
      style={{ border: '1px solid rgba(234,229,219,.25)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
      {avisos.map((aviso, i) => <p key={i} style={{ margin: '4px 0', color: '#EAE5DB', lineHeight: 1.5 }}>{aviso}</p>)}
    </section>
  );
}
