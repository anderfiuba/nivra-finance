/**
 * Helpers para tratar o retorno do fluxo OAuth/Open Finance da Pluggy.
 *
 * Após o usuário autorizar no app/site do banco, a Pluggy redireciona para a
 * `oauthRedirectUri` informada (ex.: /app/conexoes), anexando query params
 * com o resultado. Como o redirect normalmente abre uma instância NOVA da
 * SPA, o callback in-memory `onSuccess` do PluggyConnect não dispara — então
 * precisamos detectar o item via query string e registrá-lo manualmente.
 *
 * Pluggy não documenta um único nome canônico para o param do item, então
 * aceitamos as variações conhecidas em produção: `item_id`, `itemId`.
 */

export interface PluggyReturnPayload {
  itemId?: string;
  status?: string;
  error?: string;
}

export function parsePluggyReturn(search: string): PluggyReturnPayload {
  if (!search || typeof search !== "string") return {};
  const normalized = search.startsWith("?") ? search : `?${search}`;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(normalized);
  } catch {
    return {};
  }

  const itemId = params.get("item_id") ?? params.get("itemId") ?? undefined;
  const status = params.get("status") ?? undefined;
  const error = params.get("error") ?? params.get("error_message") ?? undefined;

  return {
    ...(itemId ? { itemId } : {}),
    ...(status ? { status } : {}),
    ...(error ? { error } : {}),
  };
}

const CONNECTING_FLAG = "pluggy:connecting";
const CONNECTING_TTL_MS = 10 * 60 * 1000; // 10 minutos

export function markConnectionStarted(now: number = Date.now()): void {
  try {
    sessionStorage.setItem(CONNECTING_FLAG, String(now));
  } catch {
    /* sessionStorage indisponível — segue sem fallback */
  }
}

export function consumeConnectionFlag(now: number = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(CONNECTING_FLAG);
    if (!raw) return false;
    sessionStorage.removeItem(CONNECTING_FLAG);
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return now - ts < CONNECTING_TTL_MS;
  } catch {
    return false;
  }
}