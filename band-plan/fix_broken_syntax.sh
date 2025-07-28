#!/bin/bash

echo "🔧 Arreglando sintaxis rota después de limpiar logs..."

# Buscar archivos que tengan objetos literales colgando (líneas que empiecen con espacios seguidos de identificador:)
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  echo "Procesando: $file"
  
  # Crear backup temporal
  cp "$file" "$file.bak"
  
  # Usar awk para eliminar bloques de objetos literales huérfanos
  awk '
  BEGIN { in_object = 0; object_lines = 0 }
  
  # Detectar inicio de objeto literal huérfano (línea que empieza con espacios + identifier:)
  /^[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*:[[:space:]]*/ {
    if (!in_object) {
      in_object = 1
      object_lines = 1
      next
    }
  }
  
  # Si estamos en un objeto, continuar hasta encontrar el cierre
  in_object && /^[[:space:]]+[a-zA-Z_]/ {
    object_lines++
    next
  }
  
  # Detectar fin de objeto (línea que termina con });)
  in_object && /^[[:space:]]*\}\);?[[:space:]]*$/ {
    in_object = 0
    object_lines = 0
    next
  }
  
  # Si no estamos en objeto, imprimir la línea
  !in_object { print }
  
  # Reset si encontramos código normal
  !in_object && !/^[[:space:]]*$/ { object_lines = 0 }
  ' "$file.bak" > "$file"
  
  # Eliminar backup si no hay cambios significativos
  if diff -q "$file" "$file.bak" > /dev/null; then
    rm "$file.bak"
  else
    echo "  ✓ Arreglado: $file"
    rm "$file.bak"
  fi
done

echo "✅ Sintaxis arreglada!"