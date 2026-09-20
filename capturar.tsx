import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RarityTag } from "@/components/RarityTag";
import { supabase } from "@/integrations/supabase/client";
import { identifyCar, type CarGuess } from "@/lib/identify.functions";
import {
  RARITY_META,
  uploadCapturePhoto,
  useCatalog,
  useMyCaptures,
  type CarModel,
  type Rarity,
} from "@/lib/cardex";

export const Route = createFileRoute("/_authenticated/capturar")({
  component: CapturePage,
});

/** Misma regla que el archivo: rareza a partir del precio y las unidades. */
function guessRarity(price: number | null, units: number | null): Rarity {
  if ((price ?? 0) >= 400000 || (units !== null && units <= 2000)) return "legendario";
  if ((price ?? 0) >= 130000 || (units !== null && units <= 25000)) return "epico";
  if ((price ?? 0) >= 55000 || (units !== null && units <= 150000)) return "raro";
  return "comun";
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("No se ha podido leer la foto"));
    reader.readAsDataURL(file);
  });
}


function CapturePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: catalog = [] } = useCatalog();
  const { data: captures = [] } = useMyCaptures();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CarModel | null>(null);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newUnits, setNewUnits] = useState("");
  const [showNew, setShowNew] = useState(false);

  const [guess, setGuess] = useState<CarGuess | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const runIdentify = useServerFn(identifyCar);

  const owned = useMemo(() => new Set(captures.map((c) => c.car_model_id)), [captures]);

  const results = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return catalog
      .filter((car) => {
        const name = `${car.make} ${car.model}`.toLowerCase();
        return tokens.every((token) => name.includes(token));
      })
      .slice(0, 12);
  }, [catalog, search]);

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setGuess(null);
  }

  async function identify() {
    if (!file) {
      toast.error("Elige primero una foto del coche");
      return;
    }
    setIdentifying(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const result = await runIdentify({
        data: { imageBase64, mimeType: file.type || "image/jpeg" },
      });
      setGuess(result);

      const name = [result.make, result.model].filter(Boolean).join(" ").trim();
      if (!name) {
        toast.error("No se ha podido reconocer el coche, elígelo a mano");
        return;
      }

      const tokens = name
        .toLowerCase()
        .replace(/[()]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      // Prueba con el nombre completo y va recortando palabras finales (ej. "VII restyling").
      let match: CarModel | undefined;
      const minLength = Math.min(2, tokens.length);
      for (let length = tokens.length; length >= minLength && !match; length -= 1) {

        const slice = tokens.slice(0, length);
        match = catalog.find((car) => {
          const carName = `${car.make} ${car.model}`.toLowerCase();
          return slice.every((token) => carName.includes(token));
        });
      }


      if (match && !owned.has(match.id)) {
        setSelected(match);
        setSearch("");
        setShowNew(false);
        toast.success(`Reconocido: ${match.make} ${match.model}`);
        return;
      }

      setSelected(null);
      setSearch(name);
      if (!match) {
        setNewMake(result.make ?? "");
        setNewModel(result.model ?? "");
        setNewYear(result.year_from ? String(result.year_from) : "");
        setNewPrice(result.price_eur ? String(result.price_eur) : "");
        setNewUnits(result.units_produced ? String(result.units_produced) : "");
        setShowNew(true);
      }
      toast.success(`Reconocido: ${name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido reconocer el coche");
    } finally {
      setIdentifying(false);
    }
  }


  async function createModel() {
    if (!newMake.trim() || !newModel.trim()) {
      toast.error("Indica la marca y el modelo");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from("car_models")
      .insert({
        make: newMake.trim(),
        model: newModel.trim(),
        year_from: newYear ? Number(newYear) : null,
        price_eur: newPrice ? Number(newPrice) : null,
        units_produced: newUnits ? Number(newUnits) : null,
        is_official: false,
        created_by: uid,
      })
      .select("id, make, model, year_from, rarity, is_official")
      .single();
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Ese coche ya está en el archivo, búscalo arriba"
          : "No se ha podido añadir el modelo",
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["catalog"] });
    setSelected(data as CarModel);
    setShowNew(false);
    toast.success(`Añadido como ${RARITY_META[(data as CarModel).rarity].label}`);
  }

  async function submit() {
    if (!file) {
      toast.error("Elige una foto del coche");
      return;
    }
    if (!selected) {
      toast.error("Elige a qué coche pertenece la foto");
      return;
    }
    if (owned.has(selected.id)) {
      toast.error("Ya tienes ese coche en tu archivo");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sesión no disponible");
      const path = await uploadCapturePhoto(file);
      const { error } = await supabase.from("captures").insert({
        user_id: uid,
        car_model_id: selected.id,
        photo_path: path,
        note: note.trim() || null,
        location: location.trim() || null,
        rarity: selected.rarity,
        points: RARITY_META[selected.rarity].points,
      });
      if (error) throw error;
      await queryClient.invalidateQueries();
      toast.success(`¡${selected.make} ${selected.model} capturado!`);
      navigate({ to: "/coche/$id", params: { id: selected.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell subtitle="Nueva captura">
      <div className="space-y-8">
        <section className="journal-in">
          <div className="mb-3 border-b border-foreground pb-1 font-mono text-[10px] uppercase tracking-widest">
            1. La foto
          </div>
          <div className="relative aspect-[4/5] border border-dashed border-input bg-card">
            {preview ? (
              <img src={preview} alt="Foto elegida" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
                Haz una foto al coche o elige una de tu galería.
              </span>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="hidden"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (fileInput.current) {
                  fileInput.current.setAttribute("capture", "environment");
                  fileInput.current.click();
                }
              }}
              className="bg-primary py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
            >
              Cámara
            </button>
            <button
              type="button"
              onClick={() => {
                if (fileInput.current) {
                  fileInput.current.removeAttribute("capture");
                  fileInput.current.click();
                }
              }}
              className="border border-input py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
            >
              Galería
            </button>
          </div>
          <button
            type="button"
            onClick={identify}
            disabled={!file || identifying}
            className="mt-3 w-full border border-foreground bg-card py-3 font-mono text-[10px] uppercase tracking-[0.2em] disabled:opacity-40"
          >
            {identifying ? "Reconociendo la foto…" : "Reconocer el coche por mí"}
          </button>
          {guess && (
            <div className="mt-3 border border-border bg-card p-4">
              <span className="eyebrow">Sugerencia automática</span>
              <h3 className="font-display text-lg italic leading-tight">
                {[guess.make, guess.model].filter(Boolean).join(" ") || "Sin identificar"}
              </h3>
              <div className="mt-1">
                <RarityTag rarity={guessRarity(guess.price_eur, guess.units_produced)} />
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {guess.year_from ? `${guess.year_from} · ` : ""}
                {guess.price_eur ? `≈ ${guess.price_eur.toLocaleString("es-ES")} € · ` : ""}
                Confianza {guess.confidence}
              </p>
              {guess.note && (
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {guess.note}
                </p>
              )}
            </div>
          )}
        </section>


        <section className="journal-in">
          <div className="mb-3 border-b border-foreground pb-1 font-mono text-[10px] uppercase tracking-widest">
            2. ¿Qué coche es?
          </div>

          {selected ? (
            <div className="flex items-start justify-between border border-foreground p-4">
              <div>
                <h3 className="font-display text-xl italic leading-tight">
                  {selected.make} {selected.model}
                </h3>
                <div className="mt-1">
                  <RarityTag rarity={selected.rarity} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {RARITY_META[selected.rarity].points} puntos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en el archivo (ej. Golf GTI)"
                className="w-full border-b border-input bg-transparent py-2 text-base outline-none focus:border-accent"
              />
              <div className="mt-3 divide-y divide-border">
                {results.map((car) => (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => setSelected(car)}
                    disabled={owned.has(car.id)}
                    className="flex w-full items-center justify-between py-3 text-left disabled:opacity-40"
                  >
                    <span>
                      <span className="block font-display text-base">
                        {car.make} {car.model}
                      </span>
                      <RarityTag rarity={car.rarity} />
                    </span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {owned.has(car.id) ? "Ya la tienes" : `${RARITY_META[car.rarity].points} pts`}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="mt-4 w-full border border-input py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
              >
                No está en el archivo · añadirlo
              </button>

              {showNew && (
                <div className="mt-4 space-y-4 border border-border bg-card p-4">
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    La rareza se calcula sola con el precio aproximado y las unidades fabricadas.
                  </p>
                  <Input label="Marca" value={newMake} onChange={setNewMake} />
                  <Input label="Modelo" value={newModel} onChange={setNewModel} />
                  <Input label="Año" value={newYear} onChange={setNewYear} numeric />
                  <Input
                    label="Precio aproximado (€)"
                    value={newPrice}
                    onChange={setNewPrice}
                    numeric
                  />
                  <Input
                    label="Unidades fabricadas (si lo sabes)"
                    value={newUnits}
                    onChange={setNewUnits}
                    numeric
                  />
                  <button
                    type="button"
                    onClick={createModel}
                    className="w-full bg-primary py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
                  >
                    Añadir al archivo
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="journal-in">
          <div className="mb-3 border-b border-foreground pb-1 font-mono text-[10px] uppercase tracking-widest">
            3. Anotaciones
          </div>
          <Input label="Dónde lo viste" value={location} onChange={setLocation} />
          <div className="mt-4">
            <span className="eyebrow">Nota</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-input bg-transparent p-3 text-sm outline-none focus:border-accent"
            />
          </div>
        </section>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-full bg-primary py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar en el archivo"}
        </button>
      </div>
    </AppShell>
  );
}

function Input({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        value={value}
        inputMode={numeric ? "numeric" : "text"}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border-b border-input bg-transparent py-2 text-base outline-none focus:border-accent"
      />
    </label>
  );
}
