// Helper para padronizar respostas de erro das edge functions.
//
// Princípio: NUNCA enviar detalhes internos (mensagens de DB, payload de
// terceiros, stack traces) para o cliente. Esses detalhes vão SOMENTE para
// console.error (logs do servidor). O cliente recebe um código curto e
// estável + mensagem amigável em pt-BR.

import { corsHeaders } from "./cors.ts";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "bad_request"
  | "rate_limited"
  | "upstream_error"
  | "internal_error";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  bad_request: 400,
  rate_limited: 429,
  upstream_error: 502,
  internal_error: 500,
};

const SAFE_MESSAGE: Record<ErrorCode, string> = {
  unauthorized: "Sessão inválida ou expirada.",
  forbidden: "Você não tem permissão para esta ação.",
  not_found: "Recurso não encontrado.",
  method_not_allowed: "Método HTTP não permitido.",
  bad_request: "Requisição inválida.",
  rate_limited: "Muitas requisições. Tente novamente em instantes.",
  upstream_error: "Falha temporária ao consultar o provedor externo.",
  internal_error: "Erro interno. A equipe foi notificada.",
};

export function errorResponse(
  code: ErrorCode,
  options: { logContext?: string; logDetails?: unknown; message?: string } = {},
): Response {
  const { logContext, logDetails, message } = options;
  if (logContext) {
    // Log interno completo — NÃO vai pro cliente.
    console.error(`[${code}] ${logContext}`, logDetails ?? "");
  }
  return new Response(
    JSON.stringify({
      error: code,
      message: message ?? SAFE_MESSAGE[code],
    }),
    {
      status: STATUS_BY_CODE[code],
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}