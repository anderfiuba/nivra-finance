// Helper compartilhado para autenticar na API da Pluggy (produção).
//
// Fluxo:
// 1. POST /auth com { clientId, clientSecret } -> retorna apiKey (TTL ~2h).
// 2. Cacheamos a apiKey em memória da edge function (cold-start friendly).
// 3. Em chamadas subsequentes reutilizamos enquanto válida.

const PLUGGY_BASE_URL = "https://api.pluggy.ai";

interface CachedKey {
  apiKey: string;
  expiresAt: number; // epoch ms
}

let cached: CachedKey | null = null;

export async function getPluggyApiKey(): Promise<string> {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Pluggy ausentes (PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET).");
  }

  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.apiKey;
  }

  const res = await fetch(`${PLUGGY_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pluggy auth falhou [${res.status}]: ${body}`);
  }

  const data = (await res.json()) as { apiKey: string };
  cached = {
    apiKey: data.apiKey,
    // Pluggy retorna apiKey válida por ~2h. Armazenamos por 110 minutos.
    expiresAt: now + 110 * 60 * 1000,
  };
  return data.apiKey;
}

export async function pluggyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = await getPluggyApiKey();
  const headers = new Headers(init.headers);
  headers.set("X-API-KEY", apiKey);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${PLUGGY_BASE_URL}${path}`, { ...init, headers });
}

export { PLUGGY_BASE_URL };