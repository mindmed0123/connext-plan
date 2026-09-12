
CREATE OR REPLACE FUNCTION public.seed_perfis_permissao(_empresa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; v_perfil uuid; m public.app_modulo;
BEGIN
  IF NOT (_empresa_id = public.get_user_empresa_id() OR public.is_super_admin(auth.uid()) OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('Administrador','Acesso total a todos os módulos','all'),
    ('Gestor','Vê tudo e edita obras, orçamentos e faturamento','gestor'),
    ('Financeiro','Foco em financeiro, faturamento e cartões','financeiro'),
    ('Engenharia','Obras, etapas, execuções e vistorias','engenharia'),
    ('Operacional','Dia a dia da obra e diário (RDO)','operacional')
  ) AS t(nome,descricao,tipo) LOOP
    INSERT INTO public.perfis_permissao (empresa_id, nome, descricao)
    VALUES (_empresa_id, r.nome, r.descricao)
    ON CONFLICT (empresa_id, nome) DO UPDATE SET descricao = EXCLUDED.descricao
    RETURNING id INTO v_perfil;

    FOR m IN SELECT unnest(enum_range(NULL::public.app_modulo)) LOOP
      INSERT INTO public.perfil_permissao_itens (empresa_id, perfil_id, modulo, can_view, can_create, can_edit, can_delete)
      VALUES (
        _empresa_id, v_perfil, m,
        CASE r.tipo
          WHEN 'all' THEN true
          WHEN 'gestor' THEN true
          WHEN 'financeiro' THEN m IN ('dashboard','financeiro','faturamento','cartoes','obras','orcamentos','compradores')
          WHEN 'engenharia' THEN m IN ('dashboard','obras','etapas','execucoes','vistorias','equipes','servicos','diario')
          ELSE m IN ('dashboard','obras','etapas','vistorias','diario')
        END,
        CASE r.tipo
          WHEN 'all' THEN true
          WHEN 'gestor' THEN m <> 'equipes'
          WHEN 'financeiro' THEN m IN ('financeiro','faturamento','cartoes')
          WHEN 'engenharia' THEN m IN ('obras','etapas','execucoes','vistorias','diario')
          ELSE m IN ('diario')
        END,
        CASE r.tipo
          WHEN 'all' THEN true
          WHEN 'gestor' THEN m <> 'equipes'
          WHEN 'financeiro' THEN m IN ('financeiro','faturamento','cartoes')
          WHEN 'engenharia' THEN m IN ('obras','etapas','execucoes','vistorias','diario')
          ELSE m IN ('diario')
        END,
        CASE r.tipo WHEN 'all' THEN true ELSE false END
      )
      ON CONFLICT (empresa_id, perfil_id, modulo) DO NOTHING;
    END LOOP;
  END LOOP;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.seed_perfis_permissao(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.seed_perfis_permissao(uuid) TO authenticated;
