const { app, BrowserWindow, dialog, session } = require('electron');
const path = require('node:path');
const { resolveServerUrl } = require('./server-url.cjs');

// Tests may isolate Chromium data inside SRD; installed applications use their normal profile.
if (process.env.SRD_DESKTOP_USER_DATA_DIR) {
  app.setPath('userData', path.resolve(process.env.SRD_DESKTOP_USER_DATA_DIR));
}

let serverOrigin;
try { serverOrigin = resolveServerUrl(); }
catch (error) {
  dialog.showErrorBox('Servidor de SRD no válido', error.message);
  app.exit(1);
}

function sameOrigin(target) {
  try { return new URL(target).origin === serverOrigin; }
  catch { return false; }
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'SRD · Sistema de Registro Digital',
    width: 1360,
    height: 850,
    minWidth: 760,
    minHeight: 580,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    if (!sameOrigin(target)) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, target) => {
    if (!sameOrigin(target)) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  window.loadURL(serverOrigin).catch(() => {
    if (!window.isDestroyed()) {
      dialog.showMessageBox(window, {
        type: 'error',
        title: 'SRD no disponible',
        message: 'No se pudo conectar con el servidor de SRD.',
        detail: `Comprueba que el servidor esté disponible en ${serverOrigin} y vuelve a abrir la aplicación.`,
      }).finally(() => window.close());
    }
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) =>
    callback(permission === 'clipboard-sanitized-write' && sameOrigin(contents.getURL())));
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) =>
    permission === 'clipboard-sanitized-write' && !!contents
      && sameOrigin(contents.getURL()) && sameOrigin(requestingOrigin));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => app.quit());
