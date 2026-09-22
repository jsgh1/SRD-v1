// Capture once before React renders, including StrictMode's development checks.
// Secrets stay in memory and are never copied into query strings or storage.
const supported = ["/reset", "/invite"].includes(location.pathname);
const parts = supported ? location.hash.slice(1).split(".") : [];
export const privateLink = { id: parts[0] || "", secret: parts[1] || "" };
if (supported) history.replaceState(null, "", location.pathname);
