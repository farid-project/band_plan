# Instrucciones para Aplicar la Migración de Event Reminders

## Problema
Cuando un usuario que no es creador de una banda intenta guardar un evento, aparece el error:
```
{code: '42501', details: null, hint: null, message: 'new row violates row-level security policy for table "event_reminders"'}
```

## Solución
Se ha creado una migración que corrige las políticas RLS para la tabla `event_reminders`.

## Pasos para Aplicar la Migración

### Opción 1: Usando Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **SQL Editor**
3. Ejecuta el contenido del archivo `supabase/migrations/20250122000000_fix_event_reminders_policies.sql`
4. Haz clic en **Run** para ejecutar la migración

### Opción 2: Usando Supabase CLI

Si tienes Supabase CLI instalado:

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Aplicar la migración
supabase db push
```

### Opción 3: Aplicación Manual

Si no puedes usar las opciones anteriores, copia y pega el siguiente SQL directamente en tu base de datos:

```sql
-- Verificar si existe la tabla event_reminders y ajustar políticas si es necesario

-- Primero, verificar si la tabla existe y crearla si no existe
CREATE TABLE IF NOT EXISTS public.event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  reminder_type VARCHAR NOT NULL DEFAULT 'email',
  reminder_time TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS si no está habilitado
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view their own event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Users can create event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Users can update their own event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Users can delete their own event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Group members can manage event reminders" ON public.event_reminders;

-- Crear políticas más permisivas para event_reminders
CREATE POLICY "Group members can view event reminders"
  ON public.event_reminders FOR SELECT
  USING (
    -- El usuario puede ver recordatorios si:
    -- 1. Es el propietario del recordatorio
    user_id = auth.uid()
    OR
    -- 2. Es miembro del grupo al que pertenece el evento
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = event_reminders.event_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create event reminders"
  ON public.event_reminders FOR INSERT
  WITH CHECK (
    -- El usuario puede crear recordatorios si:
    -- 1. Es miembro del grupo al que pertenece el evento
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = event_reminders.event_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own event reminders"
  ON public.event_reminders FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own event reminders"
  ON public.event_reminders FOR DELETE
  USING (user_id = auth.uid());

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON public.event_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_user_id ON public.event_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_reminder_time ON public.event_reminders(reminder_time);
```

## Cambios Adicionales Implementados

### 1. Manejo de Errores Mejorado
- Se añadió manejo de errores específico para el código 42501 (RLS violation)
- Los errores de calendario ya no bloquean la creación de eventos
- Se registran warnings en console para debugging

### 2. Actualización de Calendarios
- La función `updateGroupCalendar` ahora maneja errores de permisos de forma más elegante
- Si hay un error de RLS en calendarios, se continúa sin generar el calendario

## Verificación

Después de aplicar la migración:

1. Intenta crear un evento como usuario que no es creador de la banda
2. El evento debería crearse correctamente sin errores
3. Revisa la consola del navegador para confirmar que no hay errores de RLS

## Rollback

Si necesitas revertir los cambios:

```sql
-- Eliminar la tabla si se creó nueva
DROP TABLE IF EXISTS public.event_reminders;

-- O restaurar políticas anteriores si existían
-- (ajustar según las políticas que tenías antes)
```