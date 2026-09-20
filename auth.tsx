import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/cardex-logo.png";

type Search = { modo?: "entrar" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search =>
    search["modo"] === "entrar" ? { modo: "entrar" } : {},
  head: () => ({
    meta: [
      { title: "Entrar en Cardex" },
      {
        name: "description",
        content: "Crea tu cuenta de Cardex para empezar a coleccionar coches reales.",
      },
      { property: "og:title", content: "Entrar en Cardex" },
      { property: "og:description", content: "Accede a tu archivo de coches." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const [signUp, setSignUp] = useState(modo !== "entrar");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (signUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/archivo", replace: true });
        } else {
          setSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/archivo", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido continuar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col border-x border-border px-6 py-10">
      <Link to="/" className="eyebrow">
        ← Cardex
      </Link>

      <div className="mt-10 flex items-center gap-4">
        <img src={logo} alt="" width={816} height={816} className="w-14" loading="lazy" />
        <div>
          <h1 className="font-display text-3xl font-black italic leading-none tracking-tighter">
            {signUp ? "Nueva ficha" : "Bienvenido"}
          </h1>
          <p className="eyebrow mt-1">{signUp ? "Crear cuenta" : "Entrar"}</p>
        </div>
      </div>

      {sent ? (
        <div className="mt-10 border-t-2 border-foreground pt-6">
          <h2 className="font-display text-2xl italic">Revisa tu correo</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Te hemos enviado un enlace de confirmación a <strong>{email}</strong>. Ábrelo para
            activar tu cuenta y volver aquí.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-10 space-y-6 border-t-2 border-foreground pt-6">
          {signUp && (
            <Field label="Nombre de coleccionista">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                placeholder="pilotodemadrid"
                className="w-full border-b border-input bg-transparent py-2 font-sans text-base outline-none focus:border-accent"
              />
            </Field>
          )}
          <Field label="Correo">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border-b border-input bg-transparent py-2 text-base outline-none focus:border-accent"
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border-b border-input bg-transparent py-2 text-base outline-none focus:border-accent"
            />
          </Field>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Un momento…" : signUp ? "Crear cuenta" : "Entrar"}
          </button>

          <button
            type="button"
            onClick={() => setSignUp((v) => !v)}
            className="w-full text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {signUp ? "Ya tengo cuenta" : "Crear una cuenta nueva"}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
