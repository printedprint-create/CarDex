import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RarityTag } from "@/components/RarityTag";
import {
  RARITIES,
  RARITY_META,
  formatPoints,
  useCatalog,
  useMyCaptures,
  useMyProfile,
  useSignedUrls,
  type Rarity,
} from "@/lib/cardex";

export const Route = createFileRoute("/_authenticated/archivo")({
  component: ArchivePage,
});

function ArchivePage() {
  const { data: catalog = [], isLoading } = useCatalog();
  const { data: captures = [] } = useMyCaptures();
  const { data: profile } = useMyProfile();
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState<Rarity | "todas">("todas");
  const [only, setOnly] = useState<"todos" | "mios" | "faltan">("todos");

  const capturedBy = useMemo(() => {
    const map = new Map<string, (typeof captures)[number]>();
    for (const c of captures) map.set(c.car_model_id, c);
    return map;
  }, [captures]);

  const { data: urls = {} } = useSignedUrls(captures.map((c) => c.photo_path));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((car) => {
      if (rarity !== "todas" && car.rarity !== rarity) return false;
      const mine = capturedBy.has(car.id);
      if (only === "mios" && !mine) return false;
      if (only === "faltan" && mine) return false;
      if (!q) return true;
      return `${car.make} ${car.model}`.toLowerCase().includes(q);
    });
  }, [catalog, search, rarity, only, capturedBy]);

  const latest = captures[0];
  const latestCar = latest ? catalog.find((c) => c.id === latest.car_model_id) : undefined;

  return (
    <AppShell subtitle={`Archivo · ${captures.length} / ${catalog.length}`}>
      <div className="space-y-10">
        <section className="journal-in">
          <div className="mb-3 flex items-baseline justify-between border-b border-foreground pb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest">Última entrada</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatPoints(profile?.points ?? 0)} pts
            </span>
          </div>

          {latest && latestCar ? (
            <Link
              to="/coche/$id"
              params={{ id: latestCar.id }}
              className="block"
              aria-label={`${latestCar.make} ${latestCar.model}`}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
                {urls[latest.photo_path] ? (
                  <img
                    src={urls[latest.photo_path]}
                    alt={`${latestCar.make} ${latestCar.model}`}
                    className="size-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 to-transparent p-5">
                  <RarityStampInline rarity={latest.rarity} />
                  <h2 className="mt-2 font-display text-4xl italic leading-none text-background">
                    {latestCar.make}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-background/80">
                    {latestCar.model}
                    {latestCar.year_from ? ` — ${latestCar.year_from}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-start justify-between">
                <p className="max-w-[24ch] text-[13px] leading-relaxed text-muted-foreground">
                  {latest.note?.trim() ||
                    (latest.location
                      ? `Registrado en ${latest.location}.`
                      : "Entrada sin anotaciones.")}
                </p>
                <div className="text-right">
                  <span className="block font-display text-2xl italic leading-none">
                    {latest.points}
                  </span>
                  <span className="eyebrow">Puntos</span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="border border-dashed border-input p-8 text-center">
              <p className="font-display text-xl italic">Tu archivo está vacío</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Saca una foto a cualquier coche para abrir tu primera ficha.
              </p>
              <Link
                to="/capturar"
                className="mt-5 inline-block bg-primary px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
              >
                Capturar coche
              </Link>
            </div>
          )}
        </section>

        <section className="journal-in">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-bold tracking-tight">El Archivo</h3>
            <div className="mx-4 h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] text-muted-foreground">
              {captures.length} / {catalog.length}
            </span>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar marca o modelo…"
            className="w-full border-b border-input bg-transparent py-2 text-base outline-none focus:border-accent"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip active={rarity === "todas"} onClick={() => setRarity("todas")}>
              Todas
            </Chip>
            {RARITIES.map((r) => (
              <Chip key={r} active={rarity === r} onClick={() => setRarity(r)}>
                {RARITY_META[r].label}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip active={only === "todos"} onClick={() => setOnly("todos")}>
              Todos
            </Chip>
            <Chip active={only === "mios"} onClick={() => setOnly("mios")}>
              Capturados
            </Chip>
            <Chip active={only === "faltan"} onClick={() => setOnly("faltan")}>
              Me faltan
            </Chip>
          </div>

          {isLoading ? (
            <p className="mt-8 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Cargando archivo…
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8">
              {rows.map((car) => {
                const mine = capturedBy.get(car.id);
                const url = mine ? urls[mine.photo_path] : undefined;
                return (
                  <Link
                    key={car.id}
                    to="/coche/$id"
                    params={{ id: car.id }}
                    className="space-y-3"
                  >
                    <div
                      className={`relative aspect-square border border-border bg-card ${
                        car.rarity === "legendario" && mine ? "shimmer" : ""
                      }`}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={`${car.make} ${car.model}`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {mine ? "…" : "Vacío"}
                        </span>
                      )}
                      <span
                        className={`absolute right-2 top-2 size-2 rounded-full ${
                          RARITY_META[car.rarity].dot
                        } ${mine ? "" : "opacity-30"}`}
                      />
                    </div>
                    <div>
                      <h4 className="font-display text-lg italic leading-tight">{car.model}</h4>
                      <p className="font-mono text-[9px] uppercase tracking-tighter text-muted-foreground">
                        {car.make}
                      </p>
                      <div className="mt-1">
                        <RarityTag rarity={car.rarity} />
                      </div>
                    </div>
                  </Link>
                );
              })}
              {rows.length === 0 && (
                <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">
                  Ningún coche coincide. Si no está en el archivo, puedes añadirlo al capturarlo.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] ${
        active ? "border-foreground bg-primary text-primary-foreground" : "border-input"
      }`}
    >
      {children}
    </button>
  );
}

function RarityStampInline({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 font-mono text-[9px] uppercase tracking-tighter ${
        rarity === "legendario" ? "bg-legendario text-primary" : "bg-accent text-accent-foreground"
      }`}
    >
      {RARITY_META[rarity].label}
    </span>
  );
}
