# Build-Plan — Entrada (entrada)
wireframe-ref: §5.1–5.5 | component: EntradaComponent | route: /entrada | ai-drawer: não

> Contrato gerado por wireframe-to-angular. O implementer lê **só** este
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

## Componentes
- Label de produto (brand, uppercase, letra pequena) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Headline H1 (Poppins bold, 2.5rem) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Subtítulo (Inter, text-secondary) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- CTA primário "Enviar meu manuscrito" → leva a T03 (Upload) após login → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Link secundário "Entrar na minha conta" → tela de login → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Elemento decorativo tipográfico "ê" (fundo, opacity baixa) → local → inline no .component.ts (compor da biblioteca DS app/ui/)

## Ligações de dados (data-model.json)
- lê: nenhum (tela pública estática)
- escreve: nenhum

## Mock (mock-data.json)
- nenhum: 3 instâncias de Nenhum → mock-data.json#/nenhum

> Importar do `mock-data.json` — **não** reinventar `const MOCK` no componente.

## Estados obrigatórios
- empty, loading, error

## IA inline
- IA não disponível nesta tela.
