-- Adiciona consentimento LGPD ao profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;

-- Tabela de auditoria (trilha imutável)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON public.audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type
  ON public.audit_log (event_type);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Usuário lê apenas seus próprios eventos
CREATE POLICY "users_select_own_audit_log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuário insere apenas eventos para si mesmo (registro client-side de login etc.)
CREATE POLICY "users_insert_own_audit_log"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Sem policies de UPDATE/DELETE: trilha é imutável para o usuário.
-- (service_role contorna RLS naturalmente para limpeza administrativa.)
