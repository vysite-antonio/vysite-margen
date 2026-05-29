-- ============================================================
-- JWT Custom Claims Hook
-- ============================================================
-- Esta función se ejecuta cada vez que Supabase genera un JWT
-- (login, refresh). Lee el rol del usuario desde user_roles e
-- inyecta 'user_role' como claim personalizado en el token.
--
-- Sin este hook, auth.jwt() ->> 'user_role' devuelve null y
-- todas las RLS policies que dependen de ese claim fallan.
--
-- IMPORTANTE: tras aplicar esta migración, debes activar el hook
-- manualmente en Supabase Dashboard:
--   Authentication → Hooks → custom_access_token_hook
--   → Select function: public.custom_access_token_hook
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims   jsonb;
  user_role text;
BEGIN
  -- Leer el rol del usuario desde user_roles
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  -- Clonar los claims existentes del evento
  claims := event->'claims';

  -- Inyectar user_role (null si no existe entrada en user_roles)
  claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));

  -- Devolver el evento con los claims actualizados
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Dar permiso a supabase_auth_admin para ejecutar el hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revocar acceso público por seguridad
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
