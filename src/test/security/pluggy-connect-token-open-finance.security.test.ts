import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("supabase/functions/pluggy-connect-token/index.ts", "utf8");

describe("[SEC] pluggy-connect-token Open Finance mobile", () => {
  it("envia oauthRedirectUri dentro de options para retorno seguro do OAuth", () => {
    expect(source).toMatch(/oauthRedirectUri/);
    expect(source).toMatch(/payload\.options\s*=\s*\{/);
  });

  it("restringe o fluxo mobile a conectores Open Finance PF/PJ", () => {
    expect(source).toMatch(/isOpenFinance=true/);
    expect(source).toMatch(/PERSONAL_BANK/);
    expect(source).toMatch(/BUSINESS_BANK/);
  });
});
