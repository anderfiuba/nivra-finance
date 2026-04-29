import { describe, it, expect } from "vitest";

/**
 * AUTH.9 / API.4 — Edge functions REJEITAM:
 *   (a) chamadas sem Authorization → 401
 *   (b) preflight OPTIONS de origin não-allowlistada → sem Allow-Origin
 *
 * Opt-in via SECURITY_E2E=1 (faz chamadas de rede reais).
 */

const URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const E2E = (import.meta as any).env?.SECURITY_E2E === "1" || process.env.SECURITY_E2E === "1";
const SHOULD_RUN = !!URL && !!KEY && E2E;
const d = SHOULD_RUN ? describe : describe.skip;

const PROTECTED = [
  "pluggy-list-items",
  "pluggy-register-item",
  "pluggy-sync-data",
  "pluggy-delete-item",
  "pluggy-connect-token",
  "account-export",
  "account-delete",
] as const;

d("[SEC] Edge functions — JWT e CORS", () => {
  for (const fn of PROTECTED) {
    it(`${fn}: sem Authorization retorna 401`, async () => {
      const r = await fetch(`${URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: KEY! },
        body: "{}",
      });
      // 401 do gateway (verify_jwt=true) ou 401 do código.
      expect(r.status).toBe(401);
    }, 15_000);

    it(`${fn}: preflight de origin não-allowlistada não devolve Allow-Origin`, async () => {
      const r = await fetch(`${URL}/functions/v1/${fn}`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization, content-type",
        },
      });
      const allowOrigin = r.headers.get("Access-Control-Allow-Origin");
      // Aceitamos null ou ausente. Qualquer eco da origem maliciosa = falha.
      expect(allowOrigin).not.toBe("https://evil.example.com");
      expect(allowOrigin).not.toBe("*");
    }, 15_000);
  }
});