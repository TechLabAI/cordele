# ADR-001 — Frontend Angular com workspace Nx

> **Data:** 2026-06-20
> **Status:** accepted
> **Decisor:** Aécio Ribeiro (sponsor) + Danilo Amaral (arquiteto)

---

## Contexto

O Cordelê precisa de uma SPA web editorial que rode no browser sem instalação. O sponsor definiu Angular + Nx como stack fixo antes do Estágio 0 (constraint TECH-001). Angular oferece ecossistema maduro para SPAs B2B com TypeScript nativo e workspace monorepo via Nx.

---

## Opções consideradas

### Opção 1 — Angular + Nx (escolhida)

- **Vantagens:**
  - Stack fixo pelo sponsor — sem risco de divergência de expectativa
  - Ecossistema B2B maduro: Angular CDK, formulários reativos, tipagem estrita
  - Nx facilita separação de libs e crescimento do monorepo
  - TypeScript compartilhado com NestJS no BFF — interfaces sem duplicação
- **Desvantagens:**
  - Curva de aprendizado maior que React para devs sem experiência Angular
  - Bundle inicial maior que frameworks mais leves
- **Custo:** Baixo — decisão de sponsor

✓ Confirmado por Danilo Amaral (arquiteto, 2026-08-20): 2 devs operando pipeline AI-assisted disponíveis para o projeto.

---

## Decisão

Escolhida: **Angular 21 + Nx 22 + Tailwind v4 + Angular CDK**.

---

## Justificativa

Decisão pré-Estágio 0 do sponsor. Protótipo de alta fidelidade já gerado em Angular valida a escolha para o contexto editorial.

---

## Como reverter se a decisão se mostrar errada

Reescrever o frontend inteiro — inviável no prazo da POC. Decisão irreversível para a POC.

---

## Sinais que indicariam que está errada

- Time sem nenhum desenvolvedor Angular no início do sprint
- Bundle > 2MB em produção sem lazy loading configurado
- Routing Angular quebrando em refresh direto de URL sem configuração de servidor

---

## Consequências

- Workspace Nx gerado pelo /estagio-0-ui como protótipo de alta fidelidade
- Componentes Angular standalone sem NgModules
- CDK para comportamento acessível (overlays, dialogs)
