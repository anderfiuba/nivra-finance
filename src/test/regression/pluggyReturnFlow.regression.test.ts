import { describe, expect, it, beforeEach } from "vitest";
import {
  parsePluggyReturn,
  markConnectionStarted,
  consumeConnectionFlag,
} from "@/lib/pluggyReturnFlow";

describe("[REG] parsePluggyReturn", () => {
  it("retorna vazio para search vazio", () => {
    expect(parsePluggyReturn("")).toEqual({});
  });

  it("extrai item_id (snake_case)", () => {
    expect(parsePluggyReturn("?item_id=abc123")).toEqual({ itemId: "abc123" });
  });

  it("extrai itemId (camelCase) e status", () => {
    expect(parsePluggyReturn("?itemId=xyz&status=UPDATED")).toEqual({
      itemId: "xyz",
      status: "UPDATED",
    });
  });

  it("extrai error", () => {
    expect(parsePluggyReturn("?error=USER_CANCELLED")).toEqual({
      error: "USER_CANCELLED",
    });
  });

  it("aceita search sem prefixo ?", () => {
    expect(parsePluggyReturn("item_id=abc")).toEqual({ itemId: "abc" });
  });

  it("prioriza item_id sobre itemId quando ambos existem", () => {
    const r = parsePluggyReturn("?item_id=snake&itemId=camel");
    expect(r.itemId).toBe("snake");
  });
});

describe("[REG] connection flag", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("retorna false quando não há flag", () => {
    expect(consumeConnectionFlag()).toBe(false);
  });

  it("retorna true e limpa quando flag está dentro do TTL", () => {
    markConnectionStarted(1000);
    expect(consumeConnectionFlag(2000)).toBe(true);
    // segunda chamada não encontra mais
    expect(consumeConnectionFlag(2000)).toBe(false);
  });

  it("retorna false quando flag está fora do TTL (>10min)", () => {
    markConnectionStarted(0);
    expect(consumeConnectionFlag(11 * 60 * 1000)).toBe(false);
  });
});