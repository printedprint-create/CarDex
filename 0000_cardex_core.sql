-- Rareza
CREATE TYPE public.car_rarity AS ENUM ('comun','raro','epico','legendario');

CREATE OR REPLACE FUNCTION public.calc_rarity(_price numeric, _units bigint)
RETURNS public.car_rarity
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN (_price IS NOT NULL AND _price >= 400000) OR (_units IS NOT NULL AND _units <= 2000) THEN 'legendario'
    WHEN (_price IS NOT NULL AND _price >= 130000) OR (_units IS NOT NULL AND _units <= 25000) THEN 'epico'
    WHEN (_price IS NOT NULL AND _price >= 55000) OR (_units IS NOT NULL AND _units <= 150000) THEN 'raro'
    ELSE 'comun'
  END::public.car_rarity
$$;

CREATE OR REPLACE FUNCTION public.rarity_points(_r public.car_rarity)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _r WHEN 'legendario' THEN 450 WHEN 'epico' THEN 180 WHEN 'raro' THEN 70 ELSE 20 END
$$;

-- Perfiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  friend_code text NOT NULL UNIQUE,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username));
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Catálogo de coches
CREATE TABLE public.car_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  year_from integer,
  price_eur numeric,
  units_produced bigint,
  rarity public.car_rarity GENERATED ALWAYS AS (public.calc_rarity(price_eur, units_produced)) STORED,
  is_official boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX car_models_unique_idx ON public.car_models (lower(make), lower(model));
CREATE INDEX car_models_make_idx ON public.car_models (make);
GRANT SELECT, INSERT ON public.car_models TO authenticated;
GRANT SELECT ON public.car_models TO anon;
GRANT ALL ON public.car_models TO service_role;
ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog public read" ON public.car_models FOR SELECT USING (true);
CREATE POLICY "authenticated can add models" ON public.car_models FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND is_official = false);

-- Capturas
CREATE TABLE public.captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  car_model_id uuid NOT NULL REFERENCES public.car_models(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  note text,
  location text,
  rarity public.car_rarity NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, car_model_id)
);
CREATE INDEX captures_user_idx ON public.captures (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captures TO authenticated;
GRANT ALL ON public.captures TO service_role;
ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "captures readable by authenticated" ON public.captures FOR SELECT TO authenticated USING (true);
CREATE POLICY "own captures insert" ON public.captures FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own captures update" ON public.captures FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own captures delete" ON public.captures FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Rareza y puntos siempre desde el catálogo
CREATE OR REPLACE FUNCTION public.set_capture_scoring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.car_rarity;
BEGIN
  SELECT rarity INTO r FROM public.car_models WHERE id = NEW.car_model_id;
  NEW.rarity := r;
  NEW.points := public.rarity_points(r);
  RETURN NEW;
END;
$$;
CREATE TRIGGER captures_scoring BEFORE INSERT OR UPDATE ON public.captures
FOR EACH ROW EXECUTE FUNCTION public.set_capture_scoring();

CREATE OR REPLACE FUNCTION public.sync_profile_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
     SET points = COALESCE((SELECT SUM(c.points) FROM public.captures c WHERE c.user_id = p.id), 0)
   WHERE p.id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN NULL;
END;
$$;
CREATE TRIGGER captures_points_sync AFTER INSERT OR UPDATE OR DELETE ON public.captures
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_points();

-- Amistades
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own friendships read" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "send friend request" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id AND requester_id <> addressee_id);
CREATE POLICY "respond friend request" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "remove friendship" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Alta automática de perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE base text; candidate text; i integer := 0; code text;
BEGIN
  base := COALESCE(NULLIF(regexp_replace(lower(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1))), '[^a-z0-9_]', '', 'g'), ''), 'piloto');
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = candidate) LOOP
    i := i + 1;
    candidate := base || i::text;
  END LOOP;
  LOOP
    code := 'CX-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE friend_code = code);
  END LOOP;
  INSERT INTO public.profiles (id, username, friend_code) VALUES (NEW.id, candidate, code);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
