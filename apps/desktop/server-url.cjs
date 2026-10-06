const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function resolveServerUrl(argv = process.argv, env = process.env) {
  const argumentsWithUrl = argv.filter(value => value.startsWith('--server-url='));
  if (argumentsWithUrl.length > 1) throw new Error('Indica una sola URL de servidor.');
  const raw = argumentsWithUrl[0]?.slice('--server-url='.length)
    ?? env.SRD_DESKTOP_SERVER_URL
    ?? 'http://127.0.0.1:8080';
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('La URL del servidor no es válida.'); }
  if (!['http:', 'https:'].includes(url.protocol)
    || (url.protocol === 'http:' && !LOOPBACK.has(url.hostname))
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Usa HTTPS o HTTP local, sin credenciales, ruta ni parámetros.');
  }
  return url.origin;
}

module.exports = { resolveServerUrl };
