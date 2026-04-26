import { describe, it, expect } from "vitest";
import { formatBRL, formatRelativeTime } from "@/lib/format";

describe("[REG] Formatadores monetários e de tempo", () => {
  it("formatBRL usa pt-BR e R$", () => {
    const out = formatBRL(1234.5);
    expect(out).toMatch(/R\$/);
    expect(out).toMatch(/1\.234,5/);
  });

  it("formatRelativeTime: nunca / agora / minutos / horas / dias", () => {
    expect(formatRelativeTime(null)).toBe("nunca sincronizado");
    expect(formatRelativeTime(new Date().toISOString())).toBe("agora há pouco");
    const m5 = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(m5)).toMatch(/há 5 min/);
    const h2 = new Date(Date.now() - 2 * 3600_000).toISOString();
    expect(formatRelativeTime(h2)).toMatch(/há 2h/);
    const d3 = new Date(Date.now() - 3 * 86400_000).toISOString();
    expect(formatRelativeTime(d3)).toMatch(/há 3d/);
  });
});