CREATE POLICY "captures readable by authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'captures');
CREATE POLICY "captures upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'captures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "captures update own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'captures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "captures delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'captures' AND (storage.foldername(name))[1] = auth.uid()::text);
