import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatPoints, useMyProfile } from "@/lib/cardex";

export const Route = createFileRoute("/_authenticated/amigos")({
  component: FriendsPage,
});

type ProfileRow = {
  id: string;
  username: string | null;
  friend_code: string;
  points: number;
};

function useFriendships(myId: string | undefined) {
  return useQuery({
    queryKey: ["friendships", myId],
    enabled: Boolean(myId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);

      if (error) throw error;

      const otherIds = (data ?? []).map((f) =>
        f.requester_id === myId ? f.addressee_id : f.requester_id,
      );

      const profiles = otherIds.length
        ? (
            await supabase
              .from("profiles")
              .select("id, username, friend_code, points")
              .in("id", otherIds)
          ).data ?? []
        : [];

      const byId = new Map(
        profiles.map((p) => [p.id, p as ProfileRow]),
      );

      return (data ?? []).map((f) => ({
        ...f,
        incoming: f.addressee_id === myId,
        other: byId.get(
          f.requester_id === myId ? f.addressee_id : f.requester_id,
        ),
      }));
    },
  });
}

function FriendsPage() {
  const { data: me } = useMyProfile();
  const queryClient = useQueryClient();

  const { data: links = [] } = useFriendships(me?.id);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [searching, setSearching] = useState(false);

  const accepted = links.filter((l) => l.status === "accepted");

  const pendingIncoming = links.filter(
    (l) => l.status === "pending" && l.incoming,
  );

  const pendingOutgoing = links.filter(
    (l) => l.status === "pending" && !l.incoming,
  );

  async function search() {
    const q = query.trim();

    if (!q || !me) return;

    setSearching(true);

    const term = q.toUpperCase().startsWith("CX-")
      ? q.toUpperCase()
      : q.toLowerCase();

    const { data, error } = await supabase.rpc("search_profiles", {
      _q: term,
    });

    setSearching(false);

    if (error) {
      toast.error("No se ha podido buscar");
      return;
    }

    setResults((data ?? []) as ProfileRow[]);
  }

  async function invite(addresseeId: string) {
    if (!me) return;

    const { error } = await supabase.from("friendships").insert({
      requester_id: me.id,
      addressee_id: addresseeId,
      status: "pending",
    });

    if (error) {
      toast.error("Ya existe una solicitud con esa persona");
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["friendships"],
    });

    toast.success("Solicitud enviada");
  }

  async function respond(id: string, accept: boolean) {
    const { error } = accept
      ? await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", id)
      : await supabase
          .from("friendships")
          .delete()
          .eq("id", id);

    if (error) {
      toast.error("No se ha podido actualizar");
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["friendships"],
    });

    toast.success(
      accept ? "Ya sois amigos" : "Solicitud rechazada",
    );
  }

  return (
    <AppShell subtitle="Amigos">
      <div className="space-y-10">

        {/* CÓDIGO DE AMIGO */}
        <section className="journal-in border border-foreground p-5">
          <p className="eyebrow">Tu código de amigo</p>

          <p className="mt-2 font-mono text-2xl tracking-[0.2em]">
            {me?.friend_code ?? "Sin código"}
          </p>

          <button
            type="button"
            onClick={() => {
              if (me?.friend_code) {
                void navigator.clipboard.writeText(
                  me.friend_code,
                );

                toast.success("Código copiado");
              }
            }}
            className="mt-3 border border-input px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Copiar código
          </button>
        </section>

        {/* BUSCAR COLECCIONISTAS */}
        <section className="journal-in">
          <h2 className="mb-3 font-display text-xl font-bold italic">
            Buscar coleccionistas
          </h2>

          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void search();
                }
              }}
              placeholder="Nombre o código CX-XXXXXX"
              className="flex-1 border-b border-input bg-transparent py-2 text-base outline-none focus:border-accent"
            />

            <button
              type="button"
              onClick={() => void search()}
              className="bg-primary px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
            >
              {searching ? "…" : "Buscar"}
            </button>
          </div>

          <div className="mt-4 divide-y divide-border">
            {results.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between py-3"
              >
                <span>
                  <span className="block font-display text-base">
                    {row.username ||
                      row.friend_code ||
                      "Usuario"}
                  </span>

                  <span className="font-mono text-[9px] uppercase text-muted-foreground">
                    {row.friend_code} ·{" "}
                    {formatPoints(row.points)} pts
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => void invite(row.id)}
                  className="border border-input px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em]"
                >
                  Añadir
                </button>
              </div>
            ))}

            {results.length === 0 && query.trim() && !searching && (
              <p className="py-4 text-sm text-muted-foreground">
                No se han encontrado coleccionistas.
              </p>
            )}
          </div>
        </section>

        {/* SOLICITUDES RECIBIDAS */}
        {pendingIncoming.length > 0 && (
          <section className="journal-in">
            <h2 className="mb-3 font-display text-xl font-bold italic">
              Solicitudes recibidas
            </h2>

            <div className="divide-y divide-border">
              {pendingIncoming.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between py-3"
                >
                  <span className="font-display text-base">
                    {l.other?.username ||
                      l.other?.friend_code ||
                      "Usuario"}
                  </span>

                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void respond(l.id, true)}
                      className="bg-primary px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-primary-foreground"
                    >
                      Aceptar
                    </button>

                    <button
                      type="button"
                      onClick={() => void respond(l.id, false)}
                      className="border border-input px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em]"
                    >
                      No
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TUS AMIGOS */}
        <section className="journal-in">
          <h2 className="mb-3 font-display text-xl font-bold italic">
            Tus amigos ({accepted.length})
          </h2>

          <div className="divide-y divide-border">
            {accepted.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between py-3"
              >
                <span>
                  <span className="block font-display text-base">
                    {l.other?.username ||
                      l.other?.friend_code ||
                      "Usuario"}
                  </span>

                  <span className="font-mono text-[9px] uppercase text-muted-foreground">
                    {formatPoints(l.other?.points ?? 0)} pts
                  </span>
                </span>

                <span className="size-1.5 rounded-full bg-accent" />
              </div>
            ))}

            {accepted.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">
                Todavía no tienes amigos. Comparte tu código
                para empezar.
              </p>
            )}
          </div>
        </section>

        {/* SOLICITUDES ENVIADAS */}
        {pendingOutgoing.length > 0 && (
          <section className="journal-in">
            <p className="eyebrow">
              Enviadas, pendientes de respuesta
            </p>

            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {pendingOutgoing
                .map(
                  (l) =>
                    l.other?.username ||
                    l.other?.friend_code ||
                    "Usuario",
                )
                .join(", ")}
            </p>
          </section>
        )}

      </div>
    </AppShell>
  );
}
