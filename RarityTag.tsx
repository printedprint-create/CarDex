import { RARITY_META, type Rarity } from "@/lib/cardex";

export function RarityDot({ rarity }: { rarity: Rarity }) {
  return <span className={`size-2 rounded-full ${RARITY_META[rarity].dot}`} />;
}

export function RarityTag({ rarity }: { rarity: Rarity }) {
  const meta = RARITY_META[rarity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] ${meta.text}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function RarityStamp({ rarity }: { rarity: Rarity }) {
  const meta = RARITY_META[rarity];
  return (
    <span
      className={`inline-block px-2 py-0.5 font-mono text-[9px] uppercase tracking-tighter ${
        rarity === "legendario"
          ? "bg-legendario text-primary"
          : rarity === "epico"
            ? "bg-epico text-primary-foreground"
            : rarity === "raro"
              ? "bg-raro text-primary-foreground"
              : "bg-primary text-primary-foreground"
      }`}
    >
      {meta.label}
    </span>
  );
}
