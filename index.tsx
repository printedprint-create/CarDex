import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/cardex-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardex — El álbum de los coches del mundo real" },
      {
        name: "description",
        content:
          "Fotografía coches por la calle, ocupa su hueco en el archivo, descubre si son comunes o legendarios y compite con tus amigos.",
      },
      { property: "og:title", content: "Cardex — El álbum de los coches del mundo real" },
      {
        property: "og:description",
        content:
          "Cada coche tiene su hueco y su rareza. Fotografíalo, colecciónalo y sube en el ranking.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/archivo", replace: true });
    });
  }, [navigate]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col justify-between border-x border-border px-6 py-10">
      <header className="journal-in">
        <p className="eyebrow">Automotive Journal / Vol. 1</p>
        <h1 className="mt-1 font-display text-5xl font-black italic leading-none tracking-tighter">
          Cardex
        </h1>
      </header>

      <div className="journal-in flex flex-col items-center py-8">
        <img
          src={logo}
          alt="Logo de Cardex: un coche con una cámara de fotos encima"
          width={816}
          height={816}
          className="w-52"
        />
        <h2 className="mt-8 text-center font-display text-3xl italic leading-tight">
          Cada coche del mundo tiene su hueco
        </h2>
        <p className="mt-4 max-w-[30ch] text-center text-sm leading-relaxed text-muted-foreground">
          Sácale una foto por la calle, ocupa su ficha en el archivo y descubre si es común, raro,
          épico o legendario. Añade amigos y compite por el mejor garaje.
        </p>
      </div>

      <div className="journal-in space-y-4 border-t-2 border-foreground pt-6">
        <Link
          to="/auth"
          className="block w-full bg-primary py-4 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-primary-foreground"
        >
          Empezar a coleccionar
        </Link>
        <Link
          to="/auth"
          search={{ modo: "entrar" }}
          className="block w-full border border-input py-4 text-center font-mono text-[11px] uppercase tracking-[0.25em]"
        >
          Ya tengo cuenta
        </Link>
      </div>
    </div>
  );
}
