import { ReactNode } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";

export default function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" aria-label="Voltar para a home">
            <Logo />
          </Link>
          <nav className="text-sm text-muted-foreground space-x-4">
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-8">{title}</h1>
        <article className="prose prose-invert max-w-none text-sm leading-relaxed space-y-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:ml-5 [&_a]:text-primary [&_a]:underline">
          {children}
        </article>
        <p className="mt-12 text-xs text-muted-foreground">
          Última atualização: 26 de abril de 2026.
        </p>
      </main>
    </div>
  );
}