# Cliente Windows de SRD

`apps/desktop` es el primer cliente Electron para Windows x64. Abre la misma interfaz React que entrega el servidor web de SRD; por ello usa los mismos permisos, rutas y sesiones del gateway. No funciona sin el servidor y todavía no ofrece modo sin conexión. No incorpora código del backend ni credenciales de servicio.

Por defecto se conecta a `http://127.0.0.1:8080`, exclusivamente para desarrollo en el mismo equipo con Docker Compose. Para otro servidor, inicia el ejecutable con `--server-url=https://servidor-de-srd` o define `SRD_DESKTOP_SERVER_URL` antes de abrirlo. Solo acepta HTTPS para servidores que no sean `localhost`, `127.0.0.1` o `::1`. La URL debe ser el origen, sin ruta, parámetros ni credenciales, y el certificado HTTPS debe ser válido para Windows. El HTTPS autofirmado local de SRD no se acepta automáticamente; no se desactiva la verificación de certificados. El servidor debe ser alcanzable desde el equipo Windows y presentar la misma web y gateway bajo ese origen.

La ventana usa `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` y `webSecurity: true`, sin preload ni IPC expuesto a React. Impide ventanas nuevas y navegación o redirecciones a otros orígenes. Solo permite escritura saneada al portapapeles desde el origen de SRD; cámara, micrófono, geolocalización y otros permisos están denegados mientras sus recorridos de escritorio no se implementen. Las exportaciones web siguen usando las descargas del navegador integrado. El perfil normal de una instalación se guarda en los datos de aplicación de Windows; las pruebas usan una carpeta aislada bajo `.local/desktop-e2e` para no tocar perfiles personales.

Desde la raíz de SRD, con Node.js 24 y Docker Desktop abierto:

```powershell
./scripts/Build-Desktop.ps1 -PackageOnly
./scripts/Test-Desktop.ps1 -Packaged
```

La compilación usa `npm ci` y las versiones de `apps/desktop/package-lock.json`, con cachés dentro de `.local`. El paquete portátil queda en `.local/desktop-out/SRD Sistema de Registro Digital-win32-x64/SRD.exe`. `./scripts/Build-Desktop.ps1` sin `-PackageOnly` también crea `.local/desktop-out/make/squirrel.windows/x64/SRD-Setup.exe` y muestra su SHA-256 y estado de firma. Ningún script publica el paquete ni instala el programa.

El instalador generado ahora es **un prototipo sin firma digital**. No se presenta en Descargas como instalador oficial, no se ha probado la instalación/desinstalación y Windows puede mostrar advertencias. Antes de distribuirlo faltan identidad visual/icono, firma válida, servidor HTTPS de producción, prueba de instalación/actualización y recorridos de acceso, permisos, exportaciones y funciones nativas en Windows. La aplicación Android con React Native sigue pendiente por separado.
