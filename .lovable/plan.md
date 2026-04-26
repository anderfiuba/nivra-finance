
## 1. Remover a sessão **Pendentes** da página Categorias

A página `Categorias` deixa de ser híbrida e passa a ter um único propósito: **visualizar gastos por categoria/subcategoria e definir limites mensais**.

### Edições em `src/pages/app/Categorizacao.tsx`
- Remover o uso de `Tabs / TabsList / TabsTrigger / TabsContent` — a página renderiza diretamente a visão "Por categoria".
- Remover a aba **Pendentes** inteira (bloco `<TabsContent value="pendentes">…</TabsContent>`, ~linhas 537–612).
- Remover imports e estados não utilizados:
  - `Tabs, TabsContent, TabsList, TabsTrigger`
  - `ArrowDownRight, ArrowUpRight, CheckCircle2, HelpCircle`
  - `Transaction`, `formatDate`
  - `pendingList`, `pendingByType`, `updateCategory` do `useFinance()`
  - estado `draftCategory` e função `handleSaveCategory`
  - `visible` e `semCategoriaCount`
- Manter `parentCategoryLabels` (ainda usado no diálogo de orçamento) e o restante da lógica de orçamentos / agregados mensais intacta.

### Sidebar (`src/components/AppSidebar.tsx`)
- Remover o badge `badgeKey: "pending"` do item **Categorias** (linha 24), já que a página deixa de tratar pendências. O contexto `pendingList` continua existindo para uso futuro, mas o badge na navegação é removido para evitar levar o usuário a uma aba que não existe mais.
- Remover o import de `useFinance` se não houver mais usos no arquivo (após a remoção do badge).

### O que **não** vamos remover
- `pendingType`, `pendingList`, `pendingByType` no `FinanceContext` — continuam disponíveis caso, no futuro, exista uma tela dedicada a pendências. Apenas a UI em Categorias é limpa.

---

## 2. Preparar o site para **modo claro** (padrão) com toggle no escuro

Hoje o app força `dark` em três lugares: `<html class="dark">` no `index.html`, `html { @apply dark }` no `src/index.css`, e o tema só existe em variáveis dark no `:root`. Precisamos:

### 2.1. Definir variáveis para o tema **claro** (padrão) e mover as atuais para `.dark`

Em `src/index.css`:
- O bloco atual de `:root` contém valores **dark**. Vamos:
  - Criar um novo `:root` com a paleta **clara** (legível, premium, mantendo a identidade azul/dourado da Nivra).
  - Mover **todas** as variáveis dark de hoje para o seletor `.dark` (já existe um esqueleto, mas está incompleto — faltam gradients, shadows, sidebar, transitions).
- Variáveis a duplicar nos dois temas (com valores apropriados):
  - Cores base: `--background, --foreground, --card, --card-foreground, --popover, --popover-foreground, --primary, --primary-foreground, --primary-glow, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --success, --success-foreground, --warning, --warning-foreground, --destructive, --destructive-foreground, --border, --input, --ring`
  - Sidebar: `--sidebar-*` (8 vars)
  - Gradients/shadows: `--gradient-primary, --gradient-hero, --gradient-card, --gradient-gold, --gradient-mesh, --shadow-elegant, --shadow-card, --shadow-glow`
  - Misc: `--radius`, `--transition-smooth`

**Paleta clara proposta (HSL, sem `hsl()` no valor — padrão do projeto):**
```
--background: 210 40% 98%;
--foreground: 222 47% 11%;
--card: 0 0% 100%;
--card-foreground: 222 47% 11%;
--popover: 0 0% 100%;
--popover-foreground: 222 47% 11%;
--primary: 214 95% 52%;          /* um pouco mais escuro p/ contraste em fundo claro */
--primary-foreground: 0 0% 100%;
--primary-glow: 214 100% 65%;
--secondary: 214 32% 94%;
--secondary-foreground: 222 47% 11%;
--muted: 210 30% 95%;
--muted-foreground: 215 16% 40%;
--accent: 38 92% 50%;
--accent-foreground: 222 47% 11%;
--success: 152 65% 38%;
--success-foreground: 0 0% 100%;
--warning: 38 92% 45%;
--warning-foreground: 222 47% 11%;
--destructive: 0 75% 50%;
--destructive-foreground: 0 0% 100%;
--border: 214 20% 88%;
--input: 214 20% 92%;
--ring: 214 95% 52%;

/* Sidebar light */
--sidebar-background: 0 0% 100%;
--sidebar-foreground: 222 30% 25%;
--sidebar-primary: 214 95% 52%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 214 32% 94%;
--sidebar-accent-foreground: 222 47% 11%;
--sidebar-border: 214 20% 90%;
--sidebar-ring: 214 95% 52%;

/* Gradients/shadows light */
--gradient-primary: linear-gradient(135deg, hsl(214 95% 52%), hsl(214 100% 65%));
--gradient-hero: radial-gradient(ellipse at top, hsl(214 95% 52% / 0.12), transparent 60%), linear-gradient(180deg, hsl(210 40% 99%), hsl(214 32% 96%));
--gradient-card: linear-gradient(180deg, hsl(0 0% 100%), hsl(214 32% 97%));
--gradient-gold: linear-gradient(135deg, hsl(38 92% 55%), hsl(38 92% 45%));
--gradient-mesh: radial-gradient(at 20% 0%, hsl(214 95% 52% / 0.10) 0%, transparent 50%), radial-gradient(at 80% 100%, hsl(214 100% 65% / 0.08) 0%, transparent 50%);
--shadow-elegant: 0 10px 40px -12px hsl(214 95% 52% / 0.25);
--shadow-card: 0 4px 20px -8px hsl(214 30% 60% / 0.15);
--shadow-glow: 0 0 60px hsl(214 100% 65% / 0.20);
```

E **completar** o seletor `.dark { … }` com a paleta atual (a que está hoje em `:root`), incluindo sidebar, gradients e shadows.

### 2.2. Tornar o tema claro o **padrão**

- `index.html`: alterar `<html lang="pt-BR" class="dark">` para `<html lang="pt-BR">`.
- `src/index.css`: remover `html { @apply dark; }` do bloco `@layer base`.

### 2.3. Toggle de tema com persistência

Já existe `next-themes` (`^0.3.0`) em `package.json` (usado por `sonner.tsx`) — vamos usá-lo para evitar reinventar a roda.

- **Novo arquivo `src/components/ThemeProvider.tsx`** — wrapper fino do `ThemeProvider` de `next-themes` configurado com:
  - `attribute="class"`, `defaultTheme="light"`, `enableSystem={false}`, `storageKey="nivra:theme"`, `disableTransitionOnChange`.
- **`src/App.tsx`**: envolver a árvore com o `ThemeProvider` (entre `TooltipProvider` e `BrowserRouter`).

### 2.4. UI de troca de tema em **Configurações**

Em `src/pages/app/Configuracoes.tsx`, no card **Preferências**:
- Substituir o item estático "Tema escuro" por um item funcional ligado ao `useTheme()`:
  - Título: **"Modo escuro"**, descrição: **"Use uma aparência escura para ambientes com pouca luz."**
  - `<Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />`
- Para evitar o flash de hidratação típico do `next-themes`, usar um `mounted` flag (`useEffect` simples) e renderizar o switch só após montar (ou usar `defaultChecked` controlado).

### 2.5. Garantir legibilidade — pequenos ajustes nas páginas

A maioria do app já usa tokens semânticos (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `bg-secondary/40`, etc.), então funciona automaticamente. Vamos auditar e corrigir apenas pontos onde **opacidades** ou **classes utilitárias diretas** podem comprometer o contraste no claro:

- `src/pages/Landing.tsx`: o hero usa `bg-gradient-hero` + `bg-gradient-mesh opacity-60` — já fica adequado com a versão clara das variáveis. Sem mudança de markup.
- `src/layouts/AppLayout.tsx`: header `bg-background/80 backdrop-blur` — funciona em ambos. Sem mudança.
- `src/pages/app/Categorizacao.tsx`: a borda forte `border-primary` no card de categoria (introduzida nas últimas edições visuais) fica muito vibrante em modo claro — substituir por `border-border` (mantendo a aparência similar nos dois temas) **apenas se** quisermos suavizar; caso contrário, mantemos como pedido pelo usuário. **Decisão**: manter `border-primary` (preferência explícita anterior do usuário). Apenas confirmar visualmente no modo claro.
- Toasts já reagem ao tema via `useTheme()` em `sonner.tsx` — sem mudanças.

> Observação: nenhuma cor hard-coded (`text-white`, `bg-black`, `#hex`) será introduzida. Tudo via tokens semânticos.

### 2.6. Sem flicker no carregamento

`next-themes` injeta um pequeno script automaticamente em apps React puros (não-Next), mas como estamos em Vite/SPA, o `defaultTheme="light"` + `attribute="class"` cuida do caso comum. Como o padrão é **light** e o HTML não terá mais `class="dark"`, a primeira pintura sai correta em claro. Quando o usuário escolhe escuro, o `next-themes` aplica `class="dark"` no `<html>` antes da hidratação visual relevante.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/app/Categorizacao.tsx` | Remove aba Pendentes, Tabs, imports/estado não usados |
| `src/components/AppSidebar.tsx` | Remove badge "pending" do item Categorias |
| `src/index.css` | Adiciona paleta clara em `:root`; move dark completo para `.dark`; remove `@apply dark` |
| `index.html` | Remove `class="dark"` do `<html>` |
| `src/components/ThemeProvider.tsx` | **Novo**: wrapper do `next-themes` (default `light`) |
| `src/App.tsx` | Envolve a árvore com `ThemeProvider` |
| `src/pages/app/Configuracoes.tsx` | Switch funcional **Modo escuro** ligado ao `useTheme` |

Sem migrações de banco, sem mudanças no contexto Finance, sem novas dependências (next-themes já instalado).
