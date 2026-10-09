$ErrorActionPreference = 'Stop'
$SrdRoot = Split-Path $PSScriptRoot -Parent
$SrdFixture = Join-Path $SrdRoot '.local/e2e-fixture.json'
$SrdRunner = Join-Path $SrdRoot 'tools/browser-tests/seed-mobile-showcase.mjs'
$SrdPlaywright = Join-Path $SrdRoot 'tools/browser-tests/node_modules/@playwright/test'

if (-not (Test-Path -LiteralPath $SrdFixture)) {
    throw 'Primero ejecuta Prepare-ExpoDemo.ps1 o Prepare-Demo.ps1 para crear las cuentas ficticias.'
}
if (-not (Test-Path -LiteralPath $SrdPlaywright)) {
    throw 'Faltan dependencias de pruebas. Ejecuta npm ci dentro de tools/browser-tests.'
}

Push-Location -LiteralPath $SrdRoot
try {
    docker compose up -d --wait --no-build treasury inventory
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron iniciar Tesorería e Inventario.' }
    foreach ($SrdService in @('treasury', 'inventory')) {
        docker compose exec -T $SrdService php artisan migrate --force
        if ($LASTEXITCODE -ne 0) { throw "Migración fallida: $SrdService" }
    }
} finally {
    Pop-Location
}

Push-Location -LiteralPath (Split-Path $SrdRunner -Parent)
try {
    node $SrdRunner
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo completar la semilla de exposición.' }
} finally {
    Pop-Location
}
