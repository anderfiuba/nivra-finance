import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

describe("[SEC] Cabeçalhos de segurança no HTML", () => {
  it("X-Content-Type-Options: nosniff", () => {
    expect(html).toMatch(/http-equiv=["']X-Content-Type-Options["']\s+content=["']nosniff["']/i);
  });
  it("Referrer-Policy estrita", () => {
    expect(html).toMatch(/name=["']referrer["']\s+content=["']strict-origin-when-cross-origin["']/i);
  });
  it("Permissions-Policy bloqueia camera/mic/geo/payment", () => {
    expect(html).toMatch(/Permissions-Policy/i);
    expect(html).toMatch(/camera=\(\)/);
    expect(html).toMatch(/microphone=\(\)/);
    expect(html).toMatch(/geolocation=\(\)/);
    expect(html).toMatch(/payment=\(\)/);
  });
});