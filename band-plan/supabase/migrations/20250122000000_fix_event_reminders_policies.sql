-- Verificar si existe la tabla event_reminders y ajustar políticas si es necesario

-- Verificar estructura actual de la tabla si existe
DO $$
BEGIN
  -- Si la tabla existe, verificar y añadir columnas faltantes
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_reminders') THEN
    -- Añadir user_id si no existe
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_reminders' AND column_name = 'user_id') THEN
      ALTER TABLE public.event_reminders ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
    
    -- Añadir otras columnas si no existen
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_reminders' AND column_name = 'reminder_type') THEN
      ALTER TABLE public.event_reminders ADD COLUMN reminder_type VARCHAR NOT NULL DEFAULT 'email';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_reminders' AND column_name = 'reminder_time') THEN
      ALTER TABLE public.event_reminders ADD COLUMN reminder_time TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_reminders' AND column_name = 'sent') THEN
      ALTER TABLE public.event_reminders ADD COLUMN sent BOOLEAN DEFAULT FALSE;
    END IF;
  ELSE
    -- Crear la tabla si no existe
    CREATE TABLE public.event_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
      user_id UUID REFERENCES auth.users(id),
      reminder_type VARCHAR NOT NULL DEFAULT 'email',
      reminder_time TIMESTAMPTZ,
      sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END
$$;

-- Habilitar RLS si no está habilitado
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view their own event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Users can create event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Users can update their own event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Users can delete their own event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Group members can manage event reminders" ON public.event_reminders;

-- Crear políticas más permisivas para event_reminders
-- Política simple que permite acceso a miembros del grupo
CREATE POLICY "Group members can access event reminders"
  ON public.event_reminders FOR ALL
  USING (
    -- El usuario puede acceder a recordatorios si es miembro del grupo del evento
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = event_reminders.event_id
      AND gm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Misma condición para insertar/actualizar
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = event_reminders.event_id
      AND gm.user_id = auth.uid()
    )
  );

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON public.event_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_user_id ON public.event_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_reminder_time ON public.event_reminders(reminder_time);