# SRD: entrega portable y semilla ficticia (13 de octubre de 2026)

Este ZIP contiene el código fuente de SRD, scripts de arranque y una semilla reproducible. No contiene bases de datos, contraseñas, correo, `node_modules` ni imágenes Docker. En cada PC se generan secretos y cuentas de prueba nuevos. La primera ejecución necesita Internet para descargar imágenes y dependencias públicas; después los datos locales permanecen en volúmenes Docker de SRD. La web todavía tiene requisitos parciales; consulta `docs/WEB_ACEPTACION.md`.

## Abrir la web y cargar la semilla en otra PC Windows

1. Instala Docker Desktop con motor de contenedores Linux, Node.js 24 y PowerShell 5.1 o posterior. Deja espacio libre para las imágenes Docker y asegúrate de que los puertos locales 8080 y 8025 estén disponibles.
2. Extrae el ZIP. Debe aparecer una carpeta `SRD`; entra en ella con PowerShell. No copies `.env`, `.local` ni volúmenes Docker de otro equipo.
3. Abre Docker Desktop y espera hasta que indique que el motor está listo. Ejecuta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Exposition.ps1 -Build -WebOnly
```

El script construye una imagen a la vez para reducir el uso de memoria, inicia los servicios de la demostración, crea las bases y ejecuta las migraciones. Si falta la dependencia JavaScript de la semilla, la instala dentro de `tools/browser-tests`. Luego crea cuentas, ocho personas ficticias, cuatro eventos con versiones ES/EN, una apertura y dos movimientos ficticios de tesorería y tres bienes de inventario. La semilla reconoce sus registros y no los duplica al ejecutarse otra vez. No representa personas ni dinero reales.

Abre `http://localhost:8080/j/srd-e2e-a/login`. La cuenta es `admin@srd-e2e.test`. El código de junta es `srd-e2e-a`. Lee el valor de `password` en `SRD\.local\e2e-fixture.json` **de esa misma PC**. El código MFA llega a `http://localhost:8025` (Mailpit local). La cuenta administradora puede tener el idioma inglés guardado; el correo MFA y los textos se muestran en ese idioma hasta que lo cambies en el perfil.

Para volver a abrir en la misma PC, ejecuta `./scripts/Start-Exposition.ps1 -WebOnly -SkipSeed`; no necesitas volver a construir ni cargar los datos. Para detener sin borrar la base, usa `./scripts/Down.ps1`. No ejecutes `docker compose down -v`: eso sí eliminaría los volúmenes de la demostración.

## Móvil opcional con Expo Go

La web no necesita Android. Si vas a mostrar la app móvil, instala Expo Go compatible con el SDK indicado en `apps/mobile-expo/README.md` y Android Platform Tools. En `SRD` ejecuta una vez `npm.cmd ci --prefix apps/mobile-expo --no-audit --no-fund`, conecta el teléfono por USB, autoriza depuración y ejecuta `./scripts/Start-ExpoGo.ps1 -AdbPath 'RUTA\A\adb.exe'`. Mantén esa terminal y el cable conectados. La app usa `http://localhost:8080`, la misma junta y la misma cuenta ficticia. Expo Go no es un APK de producción.

## Comprobación y solución rápida

- Si Docker no está listo, espera a que el motor Linux termine de iniciar y vuelve a ejecutar el mismo comando. No borres los volúmenes para reintentar.
- Si `node` o `npm.cmd` no se encuentran, instala Node.js 24 y abre una terminal nueva.
- Si el puerto 8080 u 8025 está ocupado, cierra el proceso que lo usa antes de arrancar SRD; el script no publica estos puertos fuera de `127.0.0.1`.
- Si una descarga falla, revisa la conexión y repite `-Build -WebOnly`. Las capas Docker y los paquetes correctos se reutilizan.
- Si aparece HTTP 429 al repetir muchos accesos o la semilla en poco tiempo, espera el límite temporal. No desactives la protección de inicio de sesión.
- Si una sección ajena a la demostración muestra «servicio no disponible», recuerda que este comando arranca un conjunto reducido. `./scripts/Up.ps1` inicia el conjunto completo, pero requiere más memoria y tiempo.

El ZIP contiene también `docs/CHAT.md`, `docs/TRAZABILIDAD.md` y `docs/VALIDACION.md` con el alcance, los pendientes y las pruebas. El archivo `.sha256` junto al ZIP permite verificar que no se corrompió durante la copia.
