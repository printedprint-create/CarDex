import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RarityTag } from "@/components/RarityTag";
import { supabase } from "@/integrations/supabase/client";
import { RARITY_META, useSignedUrls } from "@/lib/cardex";

export const Route = createFileRoute("/_authenticated/coches")({
  component: CochesPage,
});

type FeedRow = {
  id: string;
  user_id: string;
  car_model_id: string;
  photo_path: string;
  note: string | null;
  location: string | null;
  rarity: "comun" | "raro" | "epico" | "legendario";
  points: number;
  created_at: string;
  car_models: {
    make: string;
    model: string;
    year_from: number | null;
    rarity: "comun" | "raro" | "epico" | "legendario";
  } | null;
};

type Profile = {
  id: string;
  username: string;
};

function useCommunityCaptures() {
  return useQuery({
    queryKey: ["community-captures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captures")
        .select(`
          id,
          user_id,
          car_model_id,
          photo_path,
          note,
          location,
          rarity,
          points,
          created_at,
          car_models (
            make,
            model,
            year_from,
            rarity
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const captures = (data ?? []) as FeedRow[];
      const userIds = [...new Set(captures.map((capture) => capture.user_id))];

      if (userIds.length === 0) {
        return [];
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      if (profileError) throw profileError;

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile as Profile,
        ]),
      );

      return captures.map((capture) => ({
        ...capture,
        username: profileMap.get(capture.user_id)?.username ?? "Usuario",
      }));
    },
  });
}

function CochesPage() {
  const { data: captures = [], isLoading, error } = useCommunityCaptures();

  const { data: urls = {} } = useSignedUrls(
    captures.map((capture) => capture.photo_path),
  );

  if (isLoading) {
    return (
      <AppShell subtitle="Coches">
        <p className="eyebrow">Cargando coches…</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell subtitle="Coches">
        <div className="border border-border p-5">
          <p className="font-display text-lg italic">
            No se han podido cargar los coches.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Comprueba los permisos de Supabase.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Coches de la comunidad">
      <div className="space-y-8">
        <header>
          <p className="eyebrow">Comunidad Cardex</p>
          <h2 className="mt-1 font-display text-3xl font-black italic">
            Coches vistos
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Fotos compartidas por los coleccionistas.
          </p>
        </header>

        {captures.length === 0 ? (
          <div className="border border-dashed border-input p-8 text-center">
            <p className="font-display text-xl italic">
              Todavía no hay coches publicados.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {captures.map((capture) => {
              const car = capture.car_models;
              const photo = urls[capture.photo_path];

              return (
                <article
                  key={capture.id}
                  className="overflow-hidden border border-border bg-card"
                >
                  <div className="relative aspect-[4/5] bg-muted">
                    {photo ? (
                      <img
                        src={photo}
                        alt={
                          car
                            ? `${car.make} ${car.model}`
                            : "Coche de la comunidad"
                        }
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                        Foto no disponible
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow">Subido por</p>
                        <p className="font-display text-lg font-bold">
                          {capture.username}
                        </p>
                      </div>

                      <RarityTag rarity={capture.rarity} />
                    </div>

                    {car && (
                      <div>
                        <h3 className="font-display text-2xl italic leading-tight">
                          {car.make}
                        </h3>
                        <p className="font-display text-lg">{car.model}</p>
                      </div>
                    )}

                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {capture.location
                        ? `${capture.location} · `
                        : ""}
                      {new Date(capture.created_at).toLocaleDateString(
                        "es-ES",
                      )}
                      {" · "}
                      {RARITY_META[capture.rarity].points} puntos
                    </div>

                    {capture.note && (
                      <p className="border-l-2 border-accent pl-3 text-sm italic leading-relaxed">
                        {capture.note}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
