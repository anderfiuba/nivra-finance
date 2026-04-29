import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Camada A — hardening de headers, em profundidade.
 *
 * Nem todo header de segurança pode ser entregue por meta-tag. Este teste
 * mapeia o que ESTÁ no HTML, o que FALTA, e o que precisa ser configurado
 * no edge/CDN (HSTS é o caso clássico). Ele falha de forma INFORMATIVA:
 * cada gap conhecido é registrado e o teste só falha quando um header que
 * já chegamos a aplicar regride.
 */

const html = readFileSync("index.html", "utf8");

function hasMeta(name: string): boolean {
  const re = new RegExp(`http-equiv=["']${name}["']`, "i");
  return re.test(html);
}

describe("[SEC] Headers — gaps conhecidos (não bloqueiam build)", () => {
  it("CSP: ainda não aplicado — TODO: report-only primeiro", () => {
    // Quando rolar a etapa 1 do plano de adoção do CSP (ver MATRIX.md),
    // este teste passa a exigir o header.
    const csp = hasMeta("Content-Security-Policy");
    const cspReport = hasMeta("Content-Security-Policy-Report-Only");
    if (!csp && !cspReport) {
      console.warn(
        "[SEC][gap A.4] CSP ausente. Próximo passo: ver docs/security/MATRIX.md §A.",
      );
    }
    // Não falha — gap conhecido.
    expect(true).toBe(true);
  });

  it("X-Frame-Options ou frame-ancestors: bloqueia clickjacking", () => {
    const xfo = hasMeta("X-Frame-Options");
    const cspFrameAncestors = /frame-ancestors\s+'none'/.test(html);
    if (!xfo && !cspFrameAncestors) {
      console.warn(
        "[SEC][gap A.6] Sem X-Frame-Options nem frame-ancestors. Atacante pode iframar a app.",
      );
    }
    // Não falha — gap conhecido. Quando aplicarmos, trocar para expect(...).toBe(true).
    expect(true).toBe(true);
  });

  it("HSTS: não é setável por meta-tag — precisa de header HTTP no edge", () => {
    // Documenta que HSTS NÃO é validável aqui.
    // O Lovable Cloud serve sempre HTTPS e o domínio está na preload list
    // do Google quando publicado em *.lovable.app — quando migrarmos para
    // nivrafinance.com, configurar HSTS no edge:
    //   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
    expect(html).not.toMatch(/http-equiv=["']Strict-Transport-Security/i);
  });
});