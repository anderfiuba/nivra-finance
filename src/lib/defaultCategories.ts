/**
 * Categorias-pai PADRÃO sempre exibidas no app, em ordem alfabética PT-BR.
 * Aparecem mesmo quando não há gastos no ciclo. O usuário pode revelar as
 * demais categorias do catálogo via toggle.
 */
export const DEFAULT_PARENT_CATEGORIES = [
  "Alimentos e bebidas",
  "Lazer",
  "Moradia",
  "Saúde",
  "Serviços",
  "Transporte",
  "Viagens",
] as const;

export type DefaultParentCategory = (typeof DEFAULT_PARENT_CATEGORIES)[number];