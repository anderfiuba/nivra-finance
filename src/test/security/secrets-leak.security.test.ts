import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Caminhos do código publicado para o cliente.
const SCAN_DIRS = ["src", "index.html"];

// Padrões que NÃO podem aparecer em código client-side.
const FORBIDDEN_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "SUPABASE_SERVICE_ROLE_KEY", re: /SUPABASE_SERVICE_ROLE_KEY/ },
  { name: "PLUGGY_CLIENT_SECRET", re: /PLUGGY_CLIENT_SECRET/ },
  { name: "CRON_SHARED_SECRET", re: /CRON_SHARED_SECRET/ },
  { name: "service_role JWT", re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: "BASIC_AUTH/Bearer hardcoded", re: /Bearer\s+[A-Za-z0-9._-]{40,}/ },
  { name: "AWS Access Key", re: /AKIA[0-9A-Z]{16}/ },
];

function* walk(dir: string): Generator<string> {
  const st = statSync(dir);
  if (st.isFile()) { yield dir; return; }
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    yield* walk(join(dir, entry));
  }
}

describe("[SEC] Vazamento de segredos no bundle do cliente", () => {
  const offenders: { file: string; pattern: string; sample: string }[] = [];
  for (const root of SCAN_DIRS) {
    try {
      for (const file of walk(root)) {
        if (!/\.(ts|tsx|js|jsx|html|css|md|json)$/.test(file)) continue;
        // Os próprios testes desta suite mencionam os nomes — pular.
        if (file.includes("/test/security/")) continue;
        const content = readFileSync(file, "utf8");
        for (const { name, re } of FORBIDDEN_PATTERNS) {
          const m = content.match(re);
          if (m) offenders.push({ file, pattern: name, sample: m[0].slice(0, 40) });
        }
      }
    } catch { /* dir não existe — ok */ }
  }

  it("nenhum segredo de servidor pode estar no client bundle", () => {
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});