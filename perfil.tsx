import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { InstallApp } from "@/components/InstallApp";
import { supabase } from "@/integrations/supabase/client";
import {
  RARITIES,
  RARITY_META,
  formatPoints,
  useMyCaptures,
  useMyProfile,
  useSession,
} from "@/lib/cardex";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: session } = useSession();
  const { data: captures = [] } = useMyCaptures();

  const counts = RARITIES.map((rarity) => ({
    rarity,
    count: captures.filter((c) => c.rarity === rarity).length,
  }));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell subtitle="Tu perfil">
      <div className="space-y-10">
        <section className="journal-in border-b border-foreground pb-6">
          <p className="eyebrow">Coleccionista</p>
          <h1 className="mt-1 font-display text-4xl italic leading-none">
            {profile?.username ?? "—"}
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {session?.email}
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.2em]">{profile?.friend_code}</p>
        </section>

        <section className="journal-in grid grid-cols-2 gap-6">
          <div>
            <span className="block font-display text-5xl italic leading-none">
              {captures.length}
            </span>
            <span className="eyebrow">Coches en el archivo</span>
          </div>
          <div>
            <span className="block font-display text-5xl italic leading-none">
              {formatPoints(profile?.points ?? 0)}
            </span>
            <span className="eyebrow">Puntos</span>
          </div>
        </section>

        <section className="journal-in">
          <h2 className="mb-4 font-display text-xl font-bold italic">Por rareza</h2>
          <div className="divide-y divide-border">
            {counts.map(({ rarity, count }) => (
              <div key={rarity} className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${RARITY_META[rarity].dot}`} />
                  <span className="font-display text-base">{RARITY_META[rarity].label}</span>
                </span>
                <span className="font-mono text-xs">{count}</span>
              </div>
            ))}
          </div>
        </section>

        <InstallApp />

        <button
          type="button"
          onClick={signOut}
          className="w-full border border-input py-4 font-mono text-[11px] uppercase tracking-[0.25em]"
        >
          Cerrar sesión
        </button>
      </div>
    </AppShell>
  );
}
