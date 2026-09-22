param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$SrdRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $SrdRoot
docker info *> $null
if($LASTEXITCODE) { throw 'El motor Docker no está en ejecución. Inicia Docker Desktop y repite este script.' }
& "$PSScriptRoot/Initialize.ps1"
[string[]]$SrdBuildArgs=if($SkipBuild){'--no-build'}else{'--build'}
docker compose up -d --wait @SrdBuildArgs mysql mailpit
if($LASTEXITCODE) { throw 'Falló el arranque de MySQL o correo.' }
# Add missing service databases to an existing volume; never rotate existing credentials.
docker compose exec -T mysql bash /docker-entrypoint-initdb.d/01-services.sh
if($LASTEXITCODE) { throw 'Falló el aprovisionamiento de bases por servicio.' }
docker compose up -d --wait @SrdBuildArgs gateway identity configuration records audit files
if($LASTEXITCODE) { throw 'Falló el arranque de servicios.' }
foreach($SrdService in @('gateway','identity','configuration','records','audit','files')) {
    docker compose exec -T $SrdService php artisan migrate --force
    if($LASTEXITCODE) { throw "Migración fallida: $SrdService" }
}
docker compose up -d --wait @SrdBuildArgs web identity-scheduler configuration-scheduler records-scheduler files-scheduler
if($LASTEXITCODE) { throw 'Falló el arranque de web o planificadores.' }
docker compose up -d antivirus-updater antivirus
if($LASTEXITCODE) { throw 'Falló el arranque del antivirus. Las cargas permanecerán bloqueadas.' }
Write-Host 'SRD: http://localhost:8080 | Correo local: http://localhost:8025'
