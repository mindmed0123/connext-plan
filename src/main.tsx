import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale Vite chunks after a new deploy.
// If the browser tries to load a JS/CSS chunk that no longer exists
// (typical "white screen" on returning users), force a one-shot hard reload.
const RELOAD_FLAG = "__chunk_reload__";
function isChunkError(msg: unknown) {
  const s = String((msg as any)?.message ?? msg ?? "");
  return (
    s.includes("Failed to fetch dynamically imported module") ||
    s.includes("Importing a module script failed") ||
    s.includes("error loading dynamically imported module") ||
    s.includes("ChunkLoadError") ||
    /Loading (chunk|CSS chunk) \S+ failed/i.test(s)
  );
}
function tryReload(e: unknown) {
  if (!isChunkError(e)) return;
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, "1");
  // Cache-bust query so CDN/browser revalida
  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString());
  window.location.replace(url.toString());
}
window.addEventListener("error", (e) => tryReload(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => tryReload(e.reason));
// Limpa o flag quando o app montar com sucesso
setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);

createRoot(document.getElementById("root")!).render(<App />);
