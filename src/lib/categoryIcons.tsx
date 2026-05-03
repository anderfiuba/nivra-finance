import {
  Utensils,
  Gamepad2,
  Home,
  HeartPulse,
  Wrench,
  Bus,
  Plane,
  ShoppingBag,
  GraduationCap,
  Briefcase,
  PiggyBank,
  Receipt,
  ArrowLeftRight,
  CreditCard,
  Banknote,
  Sparkles,
  Dog,
  Baby,
  Gift,
  Smartphone,
  Tv,
  Wifi,
  Fuel,
  Car,
  Shirt,
  Music,
  BookOpen,
  Pill,
  Hammer,
  Zap,
  Droplet,
  Building2,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import lionIcon from "@/assets/icon-lion.png";

/**
 * Mapa de ícones por LABEL de categoria (PT-BR).
 * Funciona tanto pra categorias-pai (chave principal) quanto pra subcategorias
 * comuns vindas do Pluggy. A busca é case-insensitive e por substring,
 * permitindo cobrir variantes ("Alimentos e bebidas", "Restaurantes" etc.).
 *
 * Categorias com ícone customizado (não-Lucide) — como "Imposto" (cabeça de
 * leão) — usam `customSrc` ao invés de `icon`.
 */

export interface CategoryIconDef {
  icon?: LucideIcon;
  customSrc?: string;
  /** Cor opcional (HSL token). Default: muted. */
  tone?: "default" | "muted";
}

/**
 * Match por palavra-chave (substring case-insensitive). A primeira regra que
 * casa vence — por isso a ordem importa: termos mais específicos primeiro.
 */
const RULES: Array<{ test: RegExp; def: CategoryIconDef }> = [
  // ===== Categorias-pai padrão =====
  { test: /aliment|comida|restaurante|bebida|mercado|superm|food|grocery|drink/i, def: { icon: Utensils } },
  { test: /lazer|entretenim|leisure|cinema|jogo/i, def: { icon: Gamepad2 } },
  { test: /moradia|aluguel|condom|housing|imóv|imove|home|casa/i, def: { icon: Home } },
  { test: /saude|saúde|m[eé]dic|farm[áa]c|hospital|cl[íi]nic|health|pill/i, def: { icon: HeartPulse } },
  { test: /servi[çc]o|service/i, def: { icon: Wrench } },
  { test: /transporte|uber|99|t[áa]xi|metr[ôo]|[ôo]nibus|bus|taxi|transit/i, def: { icon: Bus } },
  { test: /viagem|travel|hotel|hosped|passagem/i, def: { icon: Plane } },

  // ===== Imposto / Tributos — cabeça de leão (Receita Federal) =====
  { test: /impost|tribut|tax|i\.?r\.?\b|receita federal|darf|gps/i, def: { customSrc: lionIcon } },

  // ===== Outras pais comuns do Pluggy =====
  { test: /compra|shopping|loja|store/i, def: { icon: ShoppingBag } },
  { test: /educa[çc][ãa]o|escola|faculdade|curso|education/i, def: { icon: GraduationCap } },
  { test: /trabalho|sal[áa]rio|renda|sal[áa]ry|payroll|income/i, def: { icon: Briefcase } },
  { test: /investim|aplicac|investment|poupan/i, def: { icon: PiggyBank } },
  { test: /pagamento|fatura|bill|payment/i, def: { icon: Receipt } },
  { test: /transfer/i, def: { icon: ArrowLeftRight } },
  { test: /cart[ãa]o|credit card/i, def: { icon: CreditCard } },
  { test: /saque|dep[óo]sito|cash|atm/i, def: { icon: Banknote } },
  { test: /beleza|est[ée]tic|sal[ãa]o|spa|beauty/i, def: { icon: Sparkles } },
  { test: /pet|animal|veterin/i, def: { icon: Dog } },
  { test: /filho|crian[çc]a|baby|infantil/i, def: { icon: Baby } },
  { test: /presente|gift|doa[çc]/i, def: { icon: Gift } },

  // ===== Subcategorias comuns =====
  { test: /telefonia|celular|phone/i, def: { icon: Smartphone } },
  { test: /streaming|tv|netflix|prime|disney/i, def: { icon: Tv } },
  { test: /internet|wifi|banda larga/i, def: { icon: Wifi } },
  { test: /combust[íi]vel|gasolina|fuel|posto/i, def: { icon: Fuel } },
  { test: /ve[íi]culo|carro|automoti|car/i, def: { icon: Car } },
  { test: /vestu[áa]rio|roupa|moda|cloth/i, def: { icon: Shirt } },
  { test: /m[úu]sica|spotify|music/i, def: { icon: Music } },
  { test: /livro|leitura|book/i, def: { icon: BookOpen } },
  { test: /medicamento|remedio|rem[ée]dio|farm[áa]/i, def: { icon: Pill } },
  { test: /reforma|reparo|construç|hammer|tools/i, def: { icon: Hammer } },
  { test: /energia|luz|el[ée]tric/i, def: { icon: Zap } },
  { test: /[áa]gua|water/i, def: { icon: Droplet } },
  { test: /banco|bank/i, def: { icon: Building2 } },
];

const FALLBACK: CategoryIconDef = { icon: HelpCircle, tone: "muted" };

export function getCategoryIcon(label: string | null | undefined): CategoryIconDef {
  if (!label) return FALLBACK;
  for (const rule of RULES) {
    if (rule.test.test(label)) return rule.def;
  }
  return FALLBACK;
}

interface CategoryIconProps {
  label: string | null | undefined;
  className?: string;
  /** Tamanho em px. Default: 16 (h-4 w-4). */
  size?: number;
}

/**
 * Renderiza o ícone da categoria. Lida com Lucide e ícones customizados (img).
 * Use a className para ajustar cor (text-*) e dimensões com Tailwind.
 */
export function CategoryIcon({ label, className, size = 16 }: CategoryIconProps) {
  const def = getCategoryIcon(label);
  if (def.customSrc) {
    return (
      <img
        src={def.customSrc}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }
  const Icon = def.icon ?? HelpCircle;
  return <Icon className={className} size={size} aria-hidden="true" />;
}