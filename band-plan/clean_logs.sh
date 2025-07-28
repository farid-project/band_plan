#!/bin/bash

# Script para limpiar console.log innecesarios pero mantener console.error

echo "🧹 Limpiando console.log innecesarios..."

# Buscar y eliminar líneas que contengan console.log pero NO console.error
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' '/console\.log/d'

echo "✅ Limpieza completada!"
echo "📊 Verificando console.error restantes:"
find src -name "*.ts" -o -name "*.tsx" | xargs grep "console\.error" | wc -l