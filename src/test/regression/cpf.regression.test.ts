import { describe, it, expect } from "vitest";
import { isValidCpf, formatCpf, normalizeCpf } from "@/lib/cpf";

describe("[REG] CPF — validação matemática", () => {
  it("aceita CPFs válidos conhecidos", () => {
    // CPFs gerados validamente para teste (não pertencem a ninguém).
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
  });

  it("rejeita 11 dígitos repetidos", () => {
    for (let d = 0; d <= 9; d++) {
      expect(isValidCpf(String(d).repeat(11))).toBe(false);
    }
  });

  it("rejeita comprimento incorreto", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("123456789012")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("rejeita dígitos verificadores incorretos", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("11144477736")).toBe(false);
  });

  it("normalize remove tudo que não for dígito", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
  });

  it("format aplica máscara progressivamente", () => {
    expect(formatCpf("529")).toBe("529");
    expect(formatCpf("529982")).toBe("529.982");
    expect(formatCpf("529982247")).toBe("529.982.247");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });
});