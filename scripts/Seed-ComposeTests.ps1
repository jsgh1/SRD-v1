param([string]$FixturePath)
$ErrorActionPreference='Stop'
$SrdRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $SrdRoot
if(-not $FixturePath) {
    node tools/fixture-credentials.mjs
    if($LASTEXITCODE){throw 'No se pudieron preparar las credenciales sintéticas.'}
    $FixturePath=Join-Path $SrdRoot '.local/e2e-fixture.json'
}
$SrdFixture=(Resolve-Path -LiteralPath $FixturePath).Path
if(-not $SrdFixture.StartsWith($SrdRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'La semilla debe estar dentro de SRD.'}
foreach($SrdService in @('configuration','identity')) {
    docker compose cp tools/create-fixtures.php "${SrdService}:/tmp/srd-fixtures.php"
    if($LASTEXITCODE){throw 'No se pudo copiar el generador de pruebas.'}
    docker compose cp $SrdFixture "${SrdService}:/tmp/e2e-fixture.json"
    if($LASTEXITCODE){throw 'No se pudieron preparar las credenciales sintéticas.'}
    docker compose exec -T -e SRD_ROOT=/app -e SRD_ALLOW_MYSQL_FIXTURES=1 -e SRD_FIXTURE_PATH=/tmp/e2e-fixture.json $SrdService php /tmp/srd-fixtures.php $SrdService
    if($LASTEXITCODE){throw "Falló la semilla sintética: $SrdService"}
}
