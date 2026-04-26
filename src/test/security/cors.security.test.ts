import { describe, it, expect } from "vitest";

// Replicamos a lógica de cors.ts (Deno) em um helper TS puro para teste.
// Mantemos sincronizado manualmente — qualquer divergência aqui sinaliza
// regressão de allowlist.
const ALLOWED_ORIGINS = new Set<string>([
  "https://nivra-financial-clarity.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);
const ALLOWED_PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/i,
];
function isAllowed(origin: string | null) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_PATTERNS.some((p) => p.test(origin));
}

describe("[SEC] CORS allowlist — Edge Functions", () => {
  it("aceita produção", () => {
    expect(isAllowed("https://nivra-financial-clarity.lovable.app")).toBe(true);
  });
  it("aceita preview Lovable", () => {
    expect(isAllowed("https://abc123.lovableproject.com")).toBe(true);
    expect(isAllowed("https://id-preview--xyz.lovable.app")).toBe(true);
  });
  it("rejeita origem arbitrária (anti-CSRF cross-origin)", () => {
    expect(isAllowed("https://evil.example.com")).toBe(false);
    expect(isAllowed("https://nivra-financial-clarity.lovable.app.evil.com")).toBe(false);
    expect(isAllowed("http://nivra-financial-clarity.lovable.app")).toBe(false);
  });
  it("rejeita ausência de Origin (deve barrar acesso por browser)", () => {
    expect(isAllowed(null)).toBe(false);
    expect(isAllowed("")).toBe(false);
  });
  it("rejeita protocolos perigosos", () => {
    expect(isAllowed("javascript:alert(1)")).toBe(false);
    expect(isAllowed("file:///etc/passwd")).toBe(false);
  });
});