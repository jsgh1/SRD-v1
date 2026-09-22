param([switch]$Compose,[string]$Php='G:\xampp\php\php.exe',[ValidatePattern('^[a-z0-9-]+[.]spec[.]mjs$')][string]$Spec)
$ErrorActionPreference='Stop'
$SrdRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $SrdRoot
$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $SrdRoot '.local/browsers'
$env:SRD_TEST_URL=if($Compose){'http://localhost:8080'}else{'http://127.0.0.1:5173'}
$env:SRD_MAILPIT_URL=if($Compose){'http://localhost:8025'}else{'http://127.0.0.1:8125'}
$SrdRunDirectory=Join-Path $SrdRoot ('.local/browser-runs/'+[guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $SrdRunDirectory -Force | Out-Null
$SrdSpecs=@(Get-ChildItem -LiteralPath (Join-Path $SrdRoot 'tools/browser-tests') -Filter '*.spec.mjs' -File | Sort-Object Name | Select-Object -ExpandProperty Name)
if($Spec){
    if($Spec -notin $SrdSpecs){throw 'No existe la prueba solicitada.'}
    $SrdSpecs=@($Spec)
}
$SrdFailed=$false
try {
    foreach($SrdSpec in $SrdSpecs) {
        # Each file gets its own accounts and juntas, so code cooldowns cannot cross tests.
        $SrdBrowserFixture=node tools/browser-fixture.mjs
        if($LASTEXITCODE){throw 'No se pudo preparar una ejecución aislada.'}
        $env:SRD_BROWSER_FIXTURE=$SrdBrowserFixture
        if($Compose) {
            & "$PSScriptRoot/Seed-ComposeTests.ps1" -FixturePath $SrdBrowserFixture
        } else {
            $env:SRD_FIXTURE_PATH=$SrdBrowserFixture
            foreach($SrdService in @('configuration','identity')) {
                & $Php tools/create-fixtures.php $SrdService
                if($LASTEXITCODE){throw 'Falló la preparación local de las pruebas.'}
            }
        }
        $env:SRD_BROWSER_REPORT=Join-Path $SrdRunDirectory ($SrdSpec+'.json')
        $env:SRD_BROWSER_OUTPUT=Join-Path $SrdRunDirectory ($SrdSpec+'-results')
        node tools/browser-tests/node_modules/playwright/cli.js test $SrdSpec --config tools/browser-tests/playwright.config.mjs
        if($LASTEXITCODE){$SrdFailed=$true}
    }
    node tools/merge-browser-reports.mjs $SrdRunDirectory $SrdSpecs.Count
    if($LASTEXITCODE){throw 'No se pudo consolidar la evidencia de navegador.'}
} finally {
    Remove-Item Env:SRD_BROWSER_REPORT -ErrorAction SilentlyContinue
    Remove-Item Env:SRD_BROWSER_OUTPUT -ErrorAction SilentlyContinue
}
if($SrdFailed){throw 'Fallaron pruebas de navegador. Revisar .local/browser-results.json y .local/browser-runs.'}
