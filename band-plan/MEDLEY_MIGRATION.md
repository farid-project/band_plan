# Migración del Sistema de Medleys

## Resumen de Cambios

Se ha rediseñado completamente el sistema de medleys para que sean elementos del setlist en lugar de agrupaciones de canciones existentes.

## Cambios Principales

### Antes (Sistema Anterior)
- Los medleys eran agrupaciones de canciones existentes en `setlist_songs`
- Se usaban campos `medley_group_id` y `medley_group_name` en `setlist_songs`
- Las canciones mantenían su identidad individual pero se agrupaban visualmente

### Después (Nuevo Sistema)
- Los medleys son elementos independientes del setlist
- Nueva tabla `medleys` que contiene la información del medley
- Nueva tabla `medley_songs` que relaciona medleys con canciones
- Los medleys aparecen al mismo nivel que las canciones individuales en el setlist

## Estructura de Base de Datos

### Nuevas Tablas

#### `medleys`
```sql
CREATE TABLE medleys (
  id UUID PRIMARY KEY,
  setlist_id UUID REFERENCES setlists(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

#### `medley_songs`
```sql
CREATE TABLE medley_songs (
  id UUID PRIMARY KEY,
  medley_id UUID REFERENCES medleys(id),
  song_id UUID REFERENCES songs(id),
  position INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

## Migración de Datos

### Orden de Ejecución de Migraciones

1. `20241201000000_create_medleys_table.sql` - Crear nuevas tablas
2. `20241201000002_migrate_old_medleys.sql` - Migrar datos existentes
3. `20241201000001_remove_old_medley_fields.sql` - Eliminar campos antiguos

### Proceso de Migración

1. **Crear nuevas tablas**: Se crean las tablas `medleys` y `medley_songs` con sus políticas RLS
2. **Migrar datos existentes**: 
   - Se crean medleys basados en los `medley_group_id` existentes
   - Se mueven las canciones de `setlist_songs` a `medley_songs`
   - Se eliminan las canciones agrupadas de `setlist_songs`
3. **Limpiar estructura**: Se eliminan los campos `medley_group_id` y `medley_group_name`

## Cambios en el Frontend

### Nuevos Componentes

- `CreateMedleyModal.tsx` - Modal para crear nuevos medleys
- `MedleyItem.tsx` - Componente para mostrar y editar medleys individuales

### Funciones Actualizadas

- `getSetlistsByGroup()` - Ahora incluye medleys en la consulta
- `getSetlistWithSongs()` - Incluye medleys y sus canciones
- Nuevas funciones para manejar medleys: `createMedley()`, `updateMedley()`, `deleteMedley()`, etc.

### Interfaz de Usuario

- Los medleys ahora aparecen como elementos independientes en el setlist
- Se puede crear medleys desde cero seleccionando canciones disponibles
- Cada medley se puede editar individualmente (nombre, añadir/eliminar canciones)
- Los medleys tienen un diseño visual distintivo con borde azul

## Beneficios del Nuevo Sistema

1. **Mejor organización**: Los medleys son elementos claramente definidos del setlist
2. **Más flexibilidad**: Se pueden crear medleys sin necesidad de canciones existentes
3. **Mejor UX**: Interfaz más intuitiva para gestionar medleys
4. **Escalabilidad**: Estructura más robusta para futuras funcionalidades
5. **Consistencia**: Los medleys se comportan como elementos del setlist

## Consideraciones

- La migración es irreversible una vez ejecutada
- Se recomienda hacer backup antes de ejecutar las migraciones
- Los medleys existentes se migrarán automáticamente
- La nueva estructura es más eficiente para consultas y mantenimiento 