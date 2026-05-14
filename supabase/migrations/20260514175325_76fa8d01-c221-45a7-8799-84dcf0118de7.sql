CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));

  IF lower(NEW.email) IN ('pedrolsuassuna@gmail.com','pedro@potenciasolucoes.com.br') THEN
    INSERT INTO public.user_roles (user_id, role, empresa_id)
    VALUES (NEW.id, 'super_admin', NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.pessoas
     SET user_id = NEW.id, updated_at = now()
   WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  RETURN NEW;
END;
$$;

DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'pedrolsuassuna@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, empresa_id)
    VALUES (v_uid, 'super_admin', NULL)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;