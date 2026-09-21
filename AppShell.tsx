import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMyProfile } from "@/lib/cardex";
import logo from "@/assets/cardex-logo.png";

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function AppShell({ title = "Cardex", subtitle, children }: Props) {
  const { data: profile } = useMyProfile();

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col border-x border-border bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-5 pt-6 pb-4 backdrop-blur">
        <div className="flex items-end justify-between">
          <div className="space-y-0.5">
            <h1 className="font-display text-3xl font-black italic leading-none tracking-tighter">
              {title}
            </h1>
            <p className="eyebrow">{subtitle ?? "Diario automovilístico"}</p>
          </div>
          <Link
            to="/perfil"
            className="flex size-10 items-center justify-center bg-primary font-display text-lg italic text-primary-foreground"
          >
            {(profile?.username ?? "?").charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-5 pt-6 pb-10">{children}</main>

      <footer className="sticky bottom-0 z-40 border-t border-foreground bg-background">
        <nav className="flex h-16 items-center justify-around">
          <NavItem to="/archivo" label="Archivo" />
          <NavItem to="/coches" label="Coches" />
          <Link
            to="/capturar"
            aria-label="Capturar coche"
            className="-mt-8 flex size-14 items-center justify-center rounded-full border-[6px] border-background bg-primary text-primary-foreground"
          >
            <img
              src={logo}
              alt=""
              width={28}
              height={28}
              className="size-7 invert"
              loading="lazy"
            />
          </Link>
          <NavItem to="/amigos" label="Amigos" />
          <NavItem to="/ranking" label="Ranking" />
        </nav>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      className="group flex flex-col items-center opacity-40 aria-[current=page]:opacity-100"
      activeProps={{ className: "opacity-100" }}
    >
      <span className="font-display text-base">{label}</span>
      <span className="mt-1 h-0.5 w-4 bg-transparent group-aria-[current=page]:bg-foreground" />
    </Link>
  );
}
