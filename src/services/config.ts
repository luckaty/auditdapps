// src/services/config.ts

/**
 * Parse a Vite boolean env var safely.
 * Accepts: true/false, 1/0, "true"/"false" (case-insensitive).
 * Defaults to `import.meta.env.DEV` if not set (handy for local work).
 */
function parseEnvBool(val: unknown, fallback: boolean): boolean {
  if (val == null) return fallback;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  return fallback;
}

/**
 * Use mocks?
 * - Set `VITE_USE_MOCKS=true` to force mocks
 * - Set `VITE_USE_MOCKS=false` to use live service
 * - If unset, defaults to `import.meta.env.DEV` (true in dev, false in prod)
 */
export const USE_MOCKS: boolean = parseEnvBool(
  (import.meta as any).env?.VITE_USE_MOCKS,
  Boolean(import.meta.env?.DEV)
);
