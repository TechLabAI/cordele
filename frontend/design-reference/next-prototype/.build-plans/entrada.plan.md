# Build-Plan — Entrada (entrada)
wireframe-ref: §5.1–5.5 | page: EntradaPage | route: /entrada | ai-drawer: não

> Contrato gerado por wireframe-to-react. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Primeira experiência do produto. Transmite a proposta de valor e convida ao cadastro/login. Full-bleed, fora do shell de navegação.

## Regiões / layout (best-effort da §5.2)
- [sidebar escura — fundo total, full-bleed]
- cordelê
- (label pequeno, azul brand)
- Do manuscrito ao ePub
- em minutos. [ê decorativo, fundo]
- Sem diagramador. Sem InDesign.
- Só o seu texto e o resultado.
- [ ↑ Enviar meu manuscrito ] (CTA primário, pill)
- [ Entrar na minha conta ] (link secundário)

## Componentes React
- Label de produto (brand, uppercase, letra pequena) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Headline H1 (Poppins bold, 2.5rem) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Subtítulo (Inter, text-secondary) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- CTA primário "Enviar meu manuscrito" → leva a T03 (Upload) após login → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Link secundário "Entrar na minha conta" → tela de login → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Elemento decorativo tipográfico "ê" (fundo, opacity baixa) → local → inline em app/{sid}/page.tsx ou components/{sid}/

> RSC por padrão — adicionar `'use client'` só se houver estado/eventos interativos.

## Ligações de dados (data-model.json)
- lê: nenhum (tela pública estática)
- escreve: nenhum

> Fetch em RSC: `const data = await fetch('/api/...').then(r => r.json())`
> Mutações: Server Actions em `app/{sid}/actions.ts` ou API Route.

## Mock (mock-data.json)
- nenhum: 3 instâncias de Nenhum → mock-data.json#/nenhum

> Importar de `lib/mock-data.ts` — não reinventar `const MOCK` na page.

## Estados obrigatórios
- empty, loading, error
> loading: usar `<Skeleton>` de components/ui/skeleton.tsx
> error: usar `<ErrorBoundary>` ou fallback no layout

## IA inline
- IA não disponível nesta tela.
