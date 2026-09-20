import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Rarity = "comun" | "raro" | "epico" | "legendario";

export const RARITIES: Rarity[] = ["comun", "raro", "epico", "legendario"];

export const RARITY_META: Record<
  Rarity,
  { label: string; points: number; dot: string; text: string }
> = {
  comun: { label: "Común", points: 20, dot: "bg-comun", text: "text-comun" },
  raro: { label: "Raro", points: 70, dot: "bg-raro", text: "text-raro" },
  epico: { label: "Épico", points: 180, dot: "bg-epico", text: "text-epico" },
  legendario: {
    label: "Legendario",
    points: 450,
    dot: "bg-legendario",
    text: "text-legendario",
  },
};

export type CarModel = {
  id: string;
  make: string;
  model: string;
  year_from: number | null;
  rarity: Rarity;
  is_official: boolean;
};

export type Capture = {
  id: string;
  user_id: string;
  car_model_id: string;
  photo_path: string;
  note: string | null;
  location: string | null;
  rarity: Rarity;
  points: number;
  created_at: string;
};

export function formatPoints(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, friend_code, points")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("car_models")
        .select("id, make, model, year_from, rarity, is_official")
        .order("make")
        .order("model");
      if (error) throw error;
      return (data ?? []) as CarModel[];
    },
  });
}

export function useMyCaptures() {
  return useQuery({
    queryKey: ["my-captures"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("captures")
        .select("id, user_id, car_model_id, photo_path, note, location, rarity, points, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Capture[];
    },
  });
}

/** Firma las URLs de las fotos (el almacén es privado). */
export function useSignedUrls(paths: string[]) {
  const key = [...paths].sort().join("|");
  return useQuery({
    queryKey: ["signed-urls", key],
    enabled: paths.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const unique = Array.from(new Set(paths));
      const { data, error } = await supabase.storage
        .from("captures")
        .createSignedUrls(unique, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      }
      return map;
    },
  });
}

export async function uploadCapturePhoto(file: File) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no disponible");
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("captures").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
