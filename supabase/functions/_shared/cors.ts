// CORS com allowlist.
//
// Mantemos um Map estático para origens "estáveis" (produção, custom domain) e
// um conjunto de wildcards (preview Lovable). O helper devolve headers já
// resolvidos para a request — se a origem não estiver na allowlist, NÃO
// devolvemos `Access-Control-Allow-Origin`, fazendo o browser bloquear.
//
// Compat: exportamos `corsHeaders` (sem origin resolvido) para handlers legados,
// usando `*` apenas em cabeçalhos não-credenciais. Para handlers novos usar
// `getCorsHeaders(req)`.

const ALLOWED_ORIGINS = new Set<string>([
  "https://nivra-financial-clarity.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  // Lovable preview/sandbox hosts.
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/i,
];

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  if (isAllowedOrigin(origin)) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin! };
  }
  // Origem não permitida: devolvemos os headers base (sem Allow-Origin).
  return { ...BASE_HEADERS };
}

// Compat: cabeçalhos com wildcard. Usar apenas onde já existe validação de
// auth via JWT/secret e não envolvemos cookies/credentials.
export const corsHeaders: Record<string, string> = {
  ...BASE_HEADERS,
  "Access-Control-Allow-Origin": "*",
};