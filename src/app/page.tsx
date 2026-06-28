import Link from 'next/link';
import { KAscendente, Wordmark } from '@/lib/brand/Logo';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <KAscendente variante="escuro" size={96} />

      <div>
        <p className="text-3xl sm:text-4xl">
          <Wordmark variante="escuro" />
        </p>
        <p className="mt-4 text-2xl font-bold text-bone sm:text-3xl">
          O corpo que não para de evoluir.
        </p>
      </div>

      <p className="max-w-md text-secundario">
        Treino e dieta que se adaptam a cada avanço seu. Sem planilha, sem achismo — um
        plano construído com você, dia após dia.
      </p>

      <div className="flex flex-col items-center gap-3">
        <Link
          href="/onboarding"
          className="rounded-full bg-pulso px-8 py-3 font-label uppercase tracking-wide text-floresta transition hover:opacity-90"
        >
          Começar
        </Link>
        <span className="text-xs text-secundario">
          Ferramenta educacional dirigida por você · Apenas 18+
        </span>
      </div>

      {/* Posicionamento "fitness honesto" — sem promessa de resultado. */}
      <p className="mt-6 max-w-md text-sm text-secundario">
        Sem milagre, sem pegadinha, sem dieta de rico. Só o que cabe na sua rotina — e
        você no comando.
      </p>
    </main>
  );
}
