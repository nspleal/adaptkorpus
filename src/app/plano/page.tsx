import Link from 'next/link';
import { KAscendente } from '@/lib/brand/Logo';

export default function Plano() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <KAscendente size={40} />
        <Link href="/" className="text-sm text-secundario hover:text-bone">
          ← início
        </Link>
      </header>
      <h1 className="text-2xl font-bold">Seu plano</h1>
      <p className="text-secundario">
        Em breve: treino + dieta do dia, registro do que você fez e ajustes automáticos.
        Esta tela exige login e assinatura ativa (gating via Supabase Auth + webhook Kiwify).
      </p>
      <Link
        href="/onboarding"
        className="w-fit rounded-full bg-pulso px-6 py-2 font-label uppercase tracking-wide text-floresta"
      >
        Gerar uma prévia
      </Link>
    </main>
  );
}
