import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RarityTag } from "@/components/RarityTag";
import { supabase } from "@/integrations/supabase/client";
import { RARITY_META, useSignedUrls, type CarModel, type Capture } from "@/lib/cardex";

export const Route = createFileRoute("/_authenticated/coche/$id")({
  component: CarPage,
});

function CarPage() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["car", id],
    queryFn: async () => {
      const [{ data: car, error }, { data: userData }] = await Promise.all([
        supabase
          .from("car_models")
          .select("id, make, model, year_from, price_eur, units_produced, rarity, is_official")
          .eq("id", id)
          .single(),
        supabase.auth.getUser(),
      ]);
      if (error) throw error;
      const uid = userData.user?.id;
      const { data: capture } = uid
        ? await supabase
            .from("captures")
            .select("id, user_id, car_model_id, photo_path, note, location, rarity, points, created_at")
            .eq("car_model_id", id)
            .eq("user_id", uid)
            .maybeSingle()
        : { data: null };
      return { car: car as CarModel & { price_eur: number | null; units_produced: number | null }, capture: capture as Capture | null };
    },
  });

  const { data: urls = {} } = useSignedUrls(data?.capture ? [data.capture.photo_path] : []);

  if (isLoading || !data) {
    return (
      <AppShell subtitle="Ficha">
        <p className="eyebrow">Abriendo ficha…</p>
      </AppShell>
    );
  }

  const { car, capture } = data;
  const photo = capture ? urls[capture.photo_path] : undefined;

  return (
    <AppShell subtitle="Ficha del archivo">
      <article className="journal-in space-y-6">
        <div className="relative aspect-[4/5] border border-border bg-card">
          {photo ? (
            <img src={photo} alt={`${car.make} ${car.model}`} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
              Todavía no tienes foto de este coche.
            </span>
          )}
        </div>

        <header className="border-b border-foreground pb-4">
          <RarityTag rarity={car.rarity} />
          <h1 className="mt-2 font-display text-4xl italic leading-none">{car.make}</h1>
          <p className="mt-1 font-display text-xl">{car.model}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {car.year_from ? `Desde ${car.year_from} · ` : ""}
            {RARITY_META[car.rarity].points} puntos
            {car.is_official ? "" : " · añadido por la comunidad"}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-4">
          <Fact
            label="Precio de referencia"
            value={car.price_eur ? `${car.price_eur.toLocaleString("es-ES")} €` : "Sin dato"}
          />
          <Fact
            label="Unidades fabricadas"
            value={
              car.units_produced ? car.units_produced.toLocaleString("es-ES") : "Producción amplia"
            }
          />
          {capture && <Fact label="Dónde lo viste" value={capture.location || "Sin lugar"} />}
          {capture && (
            <Fact
              label="Capturado"
              value={new Date(capture.created_at).toLocaleDateString("es-ES")}
            />
          )}
        </dl>

        {capture?.note ? (
          <p className="border-l-2 border-accent pl-4 text-[15px] leading-relaxed italic">
            {capture.note}
          </p>
        ) : null}

        {!capture && (
          <Link
            to="/capturar"
            className="block bg-primary py-4 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-primary-foreground"
          >
            Capturar este coche
          </Link>
        )}
      </article>
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-lg">{value}</dd>
    </div>
  );
}
