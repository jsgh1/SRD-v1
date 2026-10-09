# SRD: guía de exposición web y móvil

Esta guía corresponde al código fuente y a la semilla ficticia del 9 de octubre de 2026. La junta de demostración es `srd-e2e-a`; ninguno de sus datos representa personas, bienes o dinero reales. La semilla local verificada contiene ocho personas pendientes, cuatro eventos de agenda, tres asientos de tesorería (apertura, ingreso y egreso) y tres bienes de inventario. Los títulos y bienes nuevos incluyen versiones en español e inglés.

## Preparación en este PC

Con Docker Desktop activo y el teléfono Android conectado por USB y autorizado, ejecuta **una sola orden** desde PowerShell en `SRD`:

```powershell
./scripts/Start-Exposition.ps1
```

Esta orden inicia el conjunto ligero de Docker para web y móvil, Tesorería e Inventario, carga la semilla y abre Expo Go por USB. Mantén abierta la terminal mientras muestras el móvil. Si faltan imágenes Docker, ejecuta `./scripts/Start-Exposition.ps1 -Build`. Para iniciar solo la web sin teléfono, usa `./scripts/Start-Exposition.ps1 -WebOnly`; para omitir una semilla ya cargada, añade `-SkipSeed`. La semilla requiere `@playwright/test`: si no está instalado, ejecuta `npm ci` dentro de `tools/browser-tests` y vuelve a la raíz. No repitas la semilla inmediatamente tras varios inicios de sesión: el gateway puede responder HTTP 429 por límite temporal; espera unos minutos.

Abre la web en `http://localhost:8080/j/srd-e2e-a/login`. La cuenta de muestra es `admin@srd-e2e.test`; lee su contraseña en la propiedad `password` de `.local/e2e-fixture.json` de **este PC**. El código MFA aparece en `http://localhost:8025` (Mailpit local). El archivo de credenciales y el buzón **no se incluyen en el ZIP**. No uses datos reales durante la exposición.

## Mostrar el móvil con Expo Go

Si arrancaste solo la web, conecta el teléfono Android por USB, desbloquéalo, autoriza la depuración USB y, con Expo Go compatible con SDK 57, abre otra terminal en `SRD` y ejecuta:

```powershell
./scripts/Start-ExpoGo.ps1
```

Mantén la terminal y el cable conectados. El script reenvía por ADB los puertos locales 8080 y 8081 y abre el proyecto en Expo Go; no abre un servicio público. En la app usa servidor `http://localhost:8080`, junta `srd-e2e-a` y la misma cuenta y contraseña local. Tras MFA, presenta Inicio, Personas, Agenda, Avisos y Perfil. El inicio de sesión, estas cinco pantallas y la persistencia al reabrir Expo Go se comprobaron en un Android físico con la semilla anterior de tres personas y dos eventos. La semilla ampliada se verificó por API; refresca la app para ver sus nuevos registros.

## Recorrido sugerido para la exposición

1. En web, inicia sesión y muestra el resumen de la junta. Abre la lista de personas y la agenda con eventos de prueba.
2. Muestra Tesorería: apertura, aporte ficticio y egreso ficticio. En Inventario, abre cualquiera de los tres bienes con código `SRD-DEMO-*`.
3. En el perfil de la web, cambia a inglés para mostrar la interfaz y los nombres de bienes y eventos que tengan versión EN. Devuelve el idioma a español si lo deseas.
4. En el teléfono, abre Inicio, Personas, Agenda, Avisos y Perfil; sal y vuelve a Expo Go para mostrar que la sesión se conserva.

No prometas que todo SRD está terminado: esta es una demostración de avance. Expo Go no es un APK distribuible. La app móvil aún carece de chat, edición completa de personas, fotografías, push y selector ES/EN. La web aún tiene pendientes de aceptación en [WEB_ACEPTACION.md](WEB_ACEPTACION.md), y el estado general figura en [ESTADO.md](ESTADO.md).

## Levantar el ZIP en otro PC

Extrae el ZIP: dentro habrá una carpeta `SRD`. Instala Docker Desktop con contenedores Linux, Node.js 24, PowerShell, Android Platform Tools/ADB y Expo Go SDK 57 en el teléfono. En `SRD`, ejecuta `npm ci` en `tools/browser-tests` y en `apps/mobile-expo`, luego `./scripts/Start-Exposition.ps1 -Build` con el teléfono conectado y autorizado. El arranque crea `.env` y `.local/e2e-fixture.json` propios de ese PC; no copies credenciales desde el equipo de exposición. El primer `npm ci`, la construcción de imágenes Docker y la instalación de Expo Go requieren descargar dependencias. El proyecto no incluye bases de datos, imágenes Docker ni `node_modules` en el ZIP de código fuente.
