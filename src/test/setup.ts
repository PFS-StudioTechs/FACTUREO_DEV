import "@testing-library/jest-dom";

// Stub minimal du global Deno pour permettre l'import des Edge Functions
// (supabase/functions/**) dans les tests Vitest — ces fichiers lisent
// Deno.env.get(...) au chargement du module (ex: _shared/cors.ts).
if (typeof (globalThis as any).Deno === "undefined") {
  (globalThis as any).Deno = { env: { get: (_key: string) => undefined } };
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
