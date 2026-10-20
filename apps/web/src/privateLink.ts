// Capture once before React renders, including StrictMode's development checks.
// Secrets stay in memory and are never copied into query strings or storage.
import { setLanguage } from './i18n';
const supported = ["/reset", "/invite"].includes(location.pathname);
const parts = supported ? location.hash.slice(1).split(".") : [];
export const privateLink = { id: parts[0] || "", secret: parts[1] || "" };
if (location.pathname === '/invite' && (parts[2] === 'es' || parts[2] === 'en')) setLanguage(parts[2]);
if (supported) history.replaceState(null, "", location.pathname);
