import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatPoints, useMyProfile } from "@/lib/cardex";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
});

function useRanking() {
  return useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ranking");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function RankingPage() {
  const { data: rows = [], isLoading } = useRanking();
  const { data: me } = useMyProfile();

  return (
    <AppShell subtitle="Ranking global">
      <section className="journal-in border-t-2 border-foreground pt-4">
        <h2 className="mb-6 font-display text-xl font-bold italic">Coleccionistas</h2>
        {isLoading ? (
          <p className="eyebrow">Calculando puestos…</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row, index) => {
              const isMe = row.id === me?.id;
              return (
                <div
                  key={row.id}
                  className={`flex items-center py-4 ${isMe ? "-mx-2 bg-secondary px-2" : ""}`}
                >
                  <span className="w-8 font-mono text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <span
                      className={`block font-display text-base font-bold ${isMe ? "italic" : ""}`}
                    >
                      {isMe ? `${row.username} (tú)` : row.username}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-tighter text-muted-foreground">
                      {row.total} coches · {row.legendarios} legendarios ·{" "}
                      {formatPoints(row.points)} pts
                    </span>
                  </div>
                  <span className="size-1.5 rounded-full bg-accent" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="journal-in mt-10 border-t border-border pt-4">
        <p className="eyebrow">Cómo se puntúa</p>
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
          <li>Legendario — 450 pts</li>
          <li>Épico — 180 pts</li>
          <li>Raro — 70 pts</li>
          <li>Común — 20 pts</li>
        </ul>
      </section>
    </AppShell>
  );
}
