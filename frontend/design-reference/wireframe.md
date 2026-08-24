# Wireframe — Cordelê

> **Última atualização:** 2026-06-19
> **Status:** rascunho
> **Persistência:** PERSISTENTE — vive com o projeto durante todo o MVP
> **Autor:** Danielle Antunes (BA/PM) — validar com Danilo Amaral (arquiteto) na Fase 0.4

---

## 1. Objetivo do Artefato

Este wireframe traduz os princípios e fluxos do `ui-concept.md` em especificação visual de 8 telas, cobrindo o fluxo completo do Cordelê: da entrada ao download do ePub válido.

**Entrada:** UI Concept aprovado + Framing técnico v1 + Design System (theme.css).
**Saída:** fonte de verdade para o frontend durante o MVP. O `prototype-bundle.html` é descartável; este documento não é.
**Próximo passo:** Fase 0.3c (Prototype README) → Fase 0.4 (reconciliação com Framing v2).

---

## 2. Princípios de UX (do UI Concept)

1. **O conteúdo do autor nunca some ou se transforma sem aviso** — trechos não parseados são marcados visivelmente.
2. **O editor vê o resultado antes de exportar** — preview fiel ao ePub gerado.
3. **Erros de validação são explicados, não apenas listados** — localização + descrição + ação.
4. **Cada passo tem um próximo passo claro** — um CTA primário proeminente por tela.
5. **A ferramenta é transparente sobre o que faz e não faz** — campo de texto do manuscrito nunca é editável.
6. **Estado de validação sempre visível** — indicador persistente no header/barra de progresso.

---

## 3. Estrutura Global

### 3.1 Layout Mestre

```
┌────────────────────────────────────────────────────────────────────┐
│ TOPBAR: [Logo cordelê]  [Nome do projeto ativo]    [Usuário] [···] │
├──────────────┬─────────────────────────────────────────────────────┤
│              │                                                       │
│   SIDEBAR    │              CONTEÚDO PRINCIPAL                      │
│   (escura)   │              (tela ativa)                            │
│              │                                                       │
│   nav items  │                                                       │
│              │                                                       │
│              │                                                       │
└──────────────┴─────────────────────────────────────────────────────┘
```

**Nota:** sem painel de IA (POC determinística). §5.5 documenta "Estado de validação e progresso" em cada tela.

### 3.2 Regiões Fixas

**A. Sidebar esquerda (240px, sempre escura)**
- Logo "cordelê" no topo
- Navegação: Projetos · Novo projeto
- Usuário + logout no rodapé
- Item ativo: borda esquerda brand + fundo brand-subtle

**B. Topbar (56px)**
- Breadcrumb: Projetos / [Nome do projeto ativo]
- Barra de progresso de 4 etapas (importar → configurar → visualizar → exportar) quando projeto aberto
- Avatar do usuário + menu

**C. Conteúdo principal (flex, max-width 880px centrado)**
- Cada tela ocupa esta região
- Tela T01 (entrada) é full-bleed — sem sidebar/topbar

---

## 4. Navegação e Modelo de Dados

### 4.1 Modelo de navegação

```
T01 (Entrada)  →  T02 (Biblioteca)  →  T03 (Upload)
                                             │
                                        T04 (Revisão de estrutura)
                                             │
                                        T05 (Metadados)
                                             │
                                        T06 (Layout / Preview)
                                             │
                                        T07 (Exportação + Validação)
                                             │
                              ┌──────────────┴──────────────┐
                         T08a (Download — sucesso)    T08b (Erros — falha)
```

Usuário logado começa em T02 (Biblioteca). T01 é tela de entrada pública / primeiro acesso.

### 4.2 Estrutura de IDs HTML

```
#section-entrada
#section-biblioteca
#section-upload
#section-revisao
#section-metadados
#section-preview
#section-exportacao
#section-resultado
```

### 4.3 Modelo de dados

```data-model
entity ProjetoEditorial "Projeto editorial — agrupa manuscrito, metadados e publicações"
  id              string pk
  nome            string
  status          enum rascunho|em_composicao|publicado|com_erros
  criadoEm        datetime
  ultimaAtividade datetime?
  editora         ref Editora label=nome

entity Manuscrito "Arquivo original parseado — imutável após import"
  id                    string pk
  projetoId             ref ProjetoEditorial label=nome
  nomeArquivo           string
  formato               enum docx|markdown
  totalCapitulos        int
  totalImagens          int
  trechosNaoParseados   int
  estrutura             string   # JSON serializado da árvore de conteúdo

entity Metadados "Metadados editoriais configurados pelo editor"
  id          string pk
  projetoId   ref ProjetoEditorial label=nome
  titulo      string
  autor       string
  isbn        string?              source=mock
  idioma      enum pt|en|es|fr     
  categoria   string?              source=mock
  capaUrl     string?
  editoraNome string?              source=mock

entity ConfiguracaoLayout "Ajustes de estilo do editor"
  id                  string pk
  projetoId           ref ProjetoEditorial label=nome
  fonteCorpoFamilia   enum serif|sans-serif
  fonteCorpoTamanho   int
  espacamentoLinha    decimal
  margemLateral       int
  h1Tamanho           int
  h2Tamanho           int
  h3Tamanho           int

entity Publicacao "Registro de cada exportação de ePub"
  id               string pk
  projetoId        ref ProjetoEditorial label=nome
  arquivoUrl       string?
  epubcheckStatus  enum valido|avisos|erros_criticos|pendente
  totalErros       int
  totalAvisos      int
  erros            string?   # JSON com lista de erros categorizados
  criadoEm         datetime

entity Editora "Conta da editora (tenant simplificado para POC)"
  id    string pk
  nome  string
  email string
```

---

## 5. Wireframe por Tela

---

# TELA 01 — Entrada

> momento-marca: true

## 5.1 Objetivo
Primeira experiência do produto. Transmite a proposta de valor e convida ao cadastro/login. Full-bleed, fora do shell de navegação.

## 5.2 Estrutura visual

```
┌──────────────────────────────────────────────────────────────────────┐
│  [sidebar escura — fundo total, full-bleed]                          │
│                                                                      │
│          cordelê                                                      │
│          ──── (label pequeno, azul brand)                            │
│                                                                      │
│       Do manuscrito ao ePub                                          │
│       em minutos.                          [ê decorativo, fundo]     │
│                                                                      │
│       Sem diagramador. Sem InDesign.                                 │
│       Só o seu texto e o resultado.                                  │
│                                                                      │
│       [ ↑ Enviar meu manuscrito ]  (CTA primário, pill)             │
│       [ Entrar na minha conta ]    (link secundário)                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 5.3 Componentes
- Label de produto (brand, uppercase, letra pequena)
- Headline H1 (Poppins bold, 2.5rem)
- Subtítulo (Inter, text-secondary)
- CTA primário "Enviar meu manuscrito" → leva a T03 (Upload) após login
- Link secundário "Entrar na minha conta" → tela de login
- Elemento decorativo tipográfico "ê" (fundo, opacity baixa)

## 5.4 Dados — bindings
- lê: nenhum (tela pública estática)
- escreve: nenhum
- mock: nenhum

## 5.5 Estado de validação e progresso
Não aplicável — tela de entrada pública, sem estado de projeto.

---

# TELA 02 — Biblioteca de Projetos

## 5.1 Objetivo
Lista todos os projetos editoriais da editora. Ponto de partida para retomar projetos existentes ou iniciar um novo.

## 5.2 Estrutura visual

```
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │  TOPBAR: cordelê            [avatar]                 │
│            ├──────────────────────────────────────────────────────┤
│ ● Projetos │                                                       │
│   Novo     │  Seus projetos              [ + Novo projeto ]       │
│   projeto  │  ─────────────────────────────────────────────       │
│            │                                                       │
│            │  ┌──────────────────┐  ┌──────────────────┐         │
│            │  │ Romance das      │  │ Poemas do        │         │
│            │  │ Cidades          │  │ Sertão           │         │
│            │  │ Eliana Moraes    │  │ Aécio Ribeiro    │         │
│            │  │ 18 cap · 3 img   │  │ 12 cap · 0 img   │         │
│            │  │ 14/06  ● Válido  │  │ 10/06  ⚠ 1 aviso│         │
│            │  │ [ Abrir ] [↓]    │  │ [ Abrir ] [↓]    │         │
│            │  └──────────────────┘  └──────────────────┘         │
│            │                                                       │
│            │  ┌──────────────────┐                                │
│            │  │ Contos Urbanos   │                                │
│            │  │ (em andamento)   │                                │
│            │  │ Sem exportação   │                                │
│            │  │ 08/06  ○ Rascunho│                                │
│            │  │ [ Continuar ]    │                                │
│            │  └──────────────────┘                                │
└────────────┴──────────────────────────────────────────────────────┘

ESTADO VAZIO:
┌────────────────────────────────────────────────────────────────────┐
│             📄                                                      │
│   Nenhum projeto ainda.                                            │
│   Envie seu primeiro manuscrito para começar.                      │
│             [ ↑ Enviar manuscrito ]                                │
└────────────────────────────────────────────────────────────────────┘
```

## 5.3 Componentes
- Grid de cards de projeto (2 colunas desktop, 1 coluna mobile)
- Card: título, autor, contagem de capítulos/imagens, data, badge de status
- Badge de status: Válido (success) · N avisos (warning) · N erros (error) · Rascunho (neutral)
- CTA "Abrir" (primário) e botão de download ícone (secundário)
- Botão "Novo projeto" no header (vai para T03)
- Estado vazio com CTA

## 5.4 Dados — bindings
- lê: ProjetoEditorial[] (filtrado pela editora logada)
- lê: Publicacao (última por projeto, para badge de status)
- escreve: nenhum nesta tela
- mock: projetos = ProjetoEditorial × 3, publicacoes = Publicacao × 2

## 5.5 Estado de validação e progresso
Barra de progresso não exibida (sem projeto ativo). Status de cada projeto visível no card via badge.

---

# TELA 03 — Novo Projeto / Upload

## 5.1 Objetivo
Editor nomeia o projeto e faz upload do manuscrito (DOCX ou Markdown). Ponto de entrada de dados no sistema.

## 5.2 Estrutura visual

```
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │  TOPBAR: cordelê  Projetos / Novo projeto            │
│            │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░             │
│ ● Projetos │  [1 Importar] ──── 2 Configurar ──── 3 Visualizar ── 4 Exportar
│   Novo     ├──────────────────────────────────────────────────────┤
│ ●projeto   │                                                       │
│            │  Novo projeto                                         │
│            │                                                       │
│            │  Nome do projeto *                                    │
│            │  ┌──────────────────────────────────────────────┐    │
│            │  │ ex.: Romance das Cidades — Aetós 2026        │    │
│            │  └──────────────────────────────────────────────┘    │
│            │                                                       │
│            │  Manuscrito *                                         │
│            │  ┌──────────────────────────────────────────────┐    │
│            │  │                                              │    │
│            │  │    ↑  Arraste seu arquivo aqui               │    │
│            │  │    ou clique para selecionar                 │    │
│            │  │                                              │    │
│            │  │    Formatos aceitos: .docx  .md              │    │
│            │  │    Tamanho máximo: 50 MB                     │    │
│            │  └──────────────────────────────────────────────┘    │
│            │                                                       │
│            │  [ Cancelar ]              [ Importar manuscrito → ] │
└────────────┴──────────────────────────────────────────────────────┘

ESTADO DE UPLOAD EM ANDAMENTO:
┌──────────────────────────────────────────────────────────────────┐
│  romance-das-cidades.docx                            68%         │
│  ████████████████████░░░░░░░░░  Analisando estrutura...          │
└──────────────────────────────────────────────────────────────────┘

ESTADO DE ERRO (arquivo inválido):
┌──────────────────────────────────────────────────────────────────┐
│  ✕  Formato não suportado. Envie um arquivo .docx ou .md.        │
└──────────────────────────────────────────────────────────────────┘
```

## 5.3 Componentes
- Campo de texto "Nome do projeto" (obrigatório)
- Drop zone de upload (drag-and-drop + click to select)
- Barra de progresso de upload + mensagem de status
- Validação inline de tipo de arquivo
- CTA "Importar manuscrito" (desabilitado até nome + arquivo preenchidos)
- Barra de etapas no topbar (etapa 1 ativa)

## 5.4 Dados — bindings
- lê: nenhum
- escreve: ProjetoEditorial.nome, ProjetoEditorial.status=rascunho
- escreve: Manuscrito.nomeArquivo, Manuscrito.formato, Manuscrito.estrutura (gerada pelo BFF)
- mock: nenhum

## 5.5 Estado de validação e progresso
Etapa 1/4 ativa na barra de progresso. Campo de arquivo com feedback inline de validação. Botão de submit desabilitado até campos obrigatórios preenchidos.

---

# TELA 04 — Revisão de Estrutura

## 5.1 Objetivo
Exibe a estrutura detectada no manuscrito após o parsing. Editor confirma, ignora trechos não reconhecidos ou decide reimportar. Garante o princípio 2.1 (nada some sem aviso).

## 5.2 Estrutura visual

```
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │  TOPBAR: cordelê  Projetos / Romance das Cidades     │
│            │  [1 Importar] ── [2 Configurar] ── 3 Visualizar ── 4 Exportar
│ ● Projetos ├──────────────────────────────────────────────────────┤
│   Novo     │                                                       │
│   projeto  │  Estrutura detectada          romance-das-cidades.docx│
│            │                                                       │
│            │  ✓ 18 capítulos encontrados                          │
│            │  ✓ 3 imagens referenciadas                           │
│            │  ⚠ 2 trechos com formatação não reconhecida          │
│            │                                                       │
│            │  SUMÁRIO                       PENDÊNCIAS             │
│            │  ─────────────────────         ──────────────────     │
│            │  ▸ Capítulo 1 — O Rio          ⚠ Pág. 34: tabela    │
│            │  ▸ Capítulo 2 — A Cidade         de formatação       │
│            │  ▸ Capítulo 3 — O Retorno        não suportada.      │
│            │  ▸ Capítulo 4 — ...              [Ignorar] [Ver]     │
│            │  ...                                                  │
│            │  ▸ Capítulo 18 — Fim           ⚠ Pág. 87: caixa    │
│            │                                  de texto flutuante. │
│            │                                  [Ignorar] [Ver]     │
│            │                                                       │
│            │  [ ← Reimportar outro arquivo ]  [ Confirmar → ]     │
└────────────┴──────────────────────────────────────────────────────┘
```

## 5.3 Componentes
- Resumo de parsing: contadores de capítulos, imagens, pendências
- Lista de capítulos detectados (sumário colapsável)
- Painel de pendências: cada trecho não reconhecido com localização, descrição e ações (Ignorar / Ver detalhes)
- CTA "Confirmar" (avança para T05) — habilitado mesmo com pendências (editor decide)
- Link "Reimportar outro arquivo" (volta a T03)
- Barra de etapas no topbar (etapa 1 completa, etapa 2 selecionada)

## 5.4 Dados — bindings
- lê: Manuscrito (estrutura, totalCapitulos, totalImagens, trechosNaoParseados)
- escreve: nenhum (read-only — manifesto do parsing)
- mock: manuscrito = Manuscrito × 1 (18 cap, 3 img, 2 trechos)

## 5.5 Estado de validação e progresso
Badge de status do projeto atualizado para "em_composicao" após confirmação. Pendências visíveis no painel direito — não bloqueiam o avanço.

---

# TELA 05 — Configuração de Metadados

## 5.1 Objetivo
Editor preenche os metadados editoriais: título, autor, ISBN, capa, idioma, categoria. Campos obrigatórios são claramente marcados.

## 5.2 Estrutura visual

```
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │  TOPBAR: cordelê  Projetos / Romance das Cidades     │
│            │  1 Importar ── [2 Configurar] ── 3 Visualizar ── 4 Exportar
│ ● Projetos ├──────────────────────────────────────────────────────┤
│   Novo     │                                                       │
│   projeto  │  Metadados do livro                                  │
│            │                                                       │
│            │  Título *          Autor *                            │
│            │  ┌──────────────┐  ┌──────────────────────────────┐  │
│            │  │ Romance das  │  │ Eliana Moraes                │  │
│            │  │ Cidades      │  └──────────────────────────────┘  │
│            │  └──────────────┘                                    │
│            │                                                       │
│            │  ISBN               Idioma *                          │
│            │  ┌──────────────┐  ┌──────────────┐                 │
│            │  │ 978-65-...   │  │ Português ▾  │                 │
│            │  └──────────────┘  └──────────────┘                 │
│            │                                                       │
│            │  Capa do livro                                       │
│            │  ┌───────────┐                                       │
│            │  │           │  Arraste uma imagem ou clique         │
│            │  │  [imagem] │  JPG ou PNG · Mín. 1400×2100px       │
│            │  │           │  [ Trocar imagem ]                    │
│            │  └───────────┘                                       │
│            │                                                       │
│            │  [ ← Voltar ]              [ Ir para preview → ]    │
└────────────┴──────────────────────────────────────────────────────┘

ESTADO DE ERRO (campo obrigatório vazio ao tentar avançar):
┌──────────────────────────────────────────────────────────────────┐
│  ! Preencha o campo "Título" para continuar.                     │
└──────────────────────────────────────────────────────────────────┘
```

## 5.3 Componentes
- Campos de texto: Título*, Autor*, ISBN (opcional), Categoria (opcional)
- Select de Idioma (pt, en, es, fr)
- Drop zone de imagem de capa com preview miniatura
- Validação inline de campos obrigatórios (marcados com *)
- CTA "Ir para preview" (desabilitado até campos obrigatórios preenchidos)
- Barra de etapas: etapa 2 ativa

## 5.4 Dados — bindings
- lê: Metadados (existente se projeto já tinha metadados)
- escreve: Metadados.titulo, Metadados.autor, Metadados.isbn, Metadados.idioma, Metadados.categoria, Metadados.capaUrl
- mock: metadados = Metadados × 1

## 5.5 Estado de validação e progresso
CTA "Ir para preview" desabilitado até Título + Autor + Idioma preenchidos. Erros de validação aparecem inline abaixo do campo, não em modal.

---

# TELA 06 — Edição de Layout

> **Renomeado de "Preview" para "Edição de Layout"** — a tela não é apenas leitura; o editor ajusta estilos e pode reorganizar o conteúdo.

## 5.1 Objetivo
Editor visualiza o manuscrito renderizado página a página com os estilos aplicados. Ajusta tipografia, espaçamento e hierarquia de títulos em tempo real. Pode adicionar páginas em branco, inserir imagens e remover páginas. Confirma que o resultado visual está correto antes de exportar.

## 5.2 Estrutura visual

```
┌────────────┬──────────────────────────────────────┬──────────────────┐
│  SIDEBAR   │  TOPBAR: Romance das Cidades          │  PAINEL DE       │
│            │  1 ── 2 ── [3 Edição] ── 4            │  ESTILOS         │
│ ● Projetos ├──────────────────────────────────────┤                  │
│   Novo     │  BARRA DE FERRAMENTAS DE EDIÇÃO       │  Tipografia      │
│   projeto  │  [ + Página ] [ ↑ Imagem ] [ ✕ Pág. ]│  Fonte corpo     │
│   Revisão  ├──────────────────────────────────────┤  [ Serif ▾ ]     │
│   Metad.   │                                        │  Tamanho: 16px   │
│ ●Edição    │    ┌──────────────────────────────┐   │                  │
│   Export.  │    │                              │   │  Espaçamento     │
│   Histórico│    │  Capítulo 1                  │   │  Linha: 1.6 ──   │
│            │    │  O Rio                       │   │                  │
│            │    │                              │   │  Hierarquia      │
│            │    │  A cidade acordou cedo...    │   │  H1: 28px ─────  │
│            │    │  texto do capítulo fluindo   │   │  H2: 22px ─────  │
│            │    │  de forma natural e contínua │   │  H3: 18px ─────  │
│            │    │                              │   │                  │
│            │    └──────────────────────────────┘   │  Margens         │
│            │                                        │  Lateral: 32px   │
│            │  ← Pág 1 de 156 →  [nome-arq.docx]  │                  │
│            │                                        │                  │
│            │  [ ← Voltar ]        [ Exportar → ]  │                  │
└────────────┴──────────────────────────────────────┴──────────────────┘

BARRA DE FERRAMENTAS (detalhamento):
┌─────────────────────────────────────────────────────────────────────┐
│  [ + Adicionar página ]  [ ↑ Inserir imagem ]  [ ✕ Remover página ]│
│  Insere pág. em          Abre seletor de        Remove a página      │
│  branco após a atual     arquivo de imagem      atualmente exibida   │
│  (ex.: folha de rosto,   (insere no início      (irreversível —      │
│   página de direitos)    da página atual)        confirmar via modal) │
└─────────────────────────────────────────────────────────────────────┘

MODAL — Confirmar remoção de página:
┌─────────────────────────────────────────────────────────────────────┐
│  Remover "Capítulo 1 — O Rio"?                                      │
│  Esta ação não pode ser desfeita nesta sessão.                      │
│                                                                      │
│  [ Cancelar ]                          [ Remover página ]           │
└─────────────────────────────────────────────────────────────────────┘

ESTADO MOBILE (painel de estilos colapsado em gaveta inferior):
┌────────────────────────────────────────────────────────────────────┐
│  TOPBAR: Romance das Cidades                                        │
│  ─────────────────────────────────────────────────────────────     │
│  [ + Pág ] [ ↑ Img ] [ ✕ Pág ]                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  Capítulo 1 — O Rio                                       │     │
│  │  A cidade acordou sob chuva fina...                       │     │
│  └──────────────────────────────────────────────────────────┘     │
│  ← Pág 1 de 156 →              [ ≡ Estilos ]  [ Exportar ]       │
└────────────────────────────────────────────────────────────────────┘
```

## 5.3 Componentes
- **Barra de ferramentas de edição** (nova — entre topbar e conteúdo):
  - Botão "Adicionar página" — insere página em branco após a atual (folha de rosto, página de direitos etc.)
  - Botão "Inserir imagem" — abre file picker (JPG/PNG/SVG), insere imagem no início da página atual
  - Botão "Remover página" — modal de confirmação antes de remover; irreversível na sessão
- Área de visualização: renderiza capítulo ativo com estilos aplicados
- Paginador: página atual / total de páginas (anterior / próxima)
- Painel de estilos lateral (desktop) / gaveta inferior (mobile):
  - Select de fonte de corpo (Serif / Sans-serif)
  - Slider de tamanho de fonte (12px–20px)
  - Slider de espaçamento de linha (1.2–2.0)
  - Sliders H1/H2/H3 tamanho
  - Slider de margens laterais
- Botão "Exportar" (CTA primário)
- Barra de etapas: etapa 3 ativa

## 5.4 Dados — bindings
- lê: Manuscrito.estrutura (capítulos renderizados)
- lê: Metadados (titulo, autor)
- lê: ConfiguracaoLayout (valores atuais dos sliders)
- escreve: ConfiguracaoLayout (todos os campos ao ajustar slider)
- escreve: Manuscrito.estrutura (ao adicionar/remover páginas — apenas na sessão, não persiste no arquivo original)
- mock: manuscrito = Manuscrito × 1, configLayout = ConfiguracaoLayout × 1

## 5.5 Estado de validação e progresso
Indicador "Layout atualizado" após cada ajuste de estilo (1-2s delay). Botão "Exportar" sempre habilitado. Ações destrutivas (remover página) exigem modal de confirmação. Remoção de página não afeta o arquivo .docx original — apenas o manifesto de composição da sessão.

---

# TELA 07 — Exportação e Validação

## 5.1 Objetivo
Exibe o processo de geração do ePub e o resultado da validação epubcheck. Se válido: libera download. Se com erros: exibe lista com localização e orientação de correção.

## 5.2 Estrutura visual

```
── ESTADO: GERANDO ──────────────────────────────────────────────────
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │  TOPBAR: Romance das Cidades  1 ── 2 ── 3 ── [4 Exportar]
│ ● Projetos ├──────────────────────────────────────────────────────┤
│   Novo     │                                                       │
│   projeto  │         Gerando seu ePub...                          │
│            │                                                       │
│            │  ████████████████░░░░░  75%                          │
│            │  Compilando capítulos                                │
│            │                                                       │
└────────────┴──────────────────────────────────────────────────────┘

── ESTADO: VÁLIDO ───────────────────────────────────────────────────
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │                                                       │
│ ● Projetos │   ✓  ePub válido e pronto para download              │
│   Novo     │                                                       │
│   projeto  │   romance-das-cidades.epub         1.4 MB            │
│            │   156 páginas · 18 capítulos · 3 imagens             │
│            │   epubcheck: 0 erros · 2 avisos                      │
│            │                                                       │
│            │   2 Avisos (não bloqueiam a distribuição)             │
│            │   ┌──────────────────────────────────────────────┐   │
│            │   │ ⚠ item001.xhtml: atributo "lang" ausente     │   │
│            │   │ ⚠ cover.jpg: resolução abaixo do ideal       │   │
│            │   └──────────────────────────────────────────────┘   │
│            │                                                       │
│            │   [ ← Ajustar layout ]   [ ↓ Baixar ePub ]          │
└────────────┴──────────────────────────────────────────────────────┘

── ESTADO: COM ERROS CRÍTICOS ───────────────────────────────────────
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │                                                       │
│ ● Projetos │   ✕  3 erros críticos encontrados                    │
│   Novo     │   O ePub não pode ser distribuído com estes erros.   │
│   projeto  │                                                       │
│            │   ┌──────────────────────────────────────────────┐   │
│            │   │ ✕ EPUB-020: OPF não encontrado               │   │
│            │   │   → Verifique se o manuscrito tem estrutura   │   │
│            │   │     de capítulos (H1 como divisores).         │   │
│            │   │                                               │   │
│            │   │ ✕ EPUB-034: imagem capa.jpg corrompida        │   │
│            │   │   → Reenvie a imagem de capa em T05.          │   │
│            │   │                                               │   │
│            │   │ ✕ EPUB-007: metadado "title" vazio           │   │
│            │   │   → Preencha o campo Título em T05.           │   │
│            │   └──────────────────────────────────────────────┘   │
│            │                                                       │
│            │   [ ← Corrigir metadados ]   [ ← Corrigir layout ]  │
└────────────┴──────────────────────────────────────────────────────┘
```

## 5.3 Componentes
- Barra de progresso de geração com status textual
- Painel de resultado: badge de status (válido / avisos / erros)
- Resumo do ePub: nome, tamanho, páginas, capítulos, imagens
- Lista de avisos (dobráveis, não bloqueantes)
- Lista de erros críticos com: código epubcheck + descrição legível + ação de correção
- CTA primário: "Baixar ePub" (só se válido) ou "Corrigir [localização]"
- Link "Ajustar layout" (volta a T06)

## 5.4 Dados — bindings
- lê: Publicacao (gerada nesta sessão — status, erros, avisos, arquivoUrl)
- lê: Manuscrito (totalCapitulos, totalImagens)
- escreve: Publicacao (criada ao acionar exportação)
- mock: publicacao = Publicacao × 1 (status=valido, 0 erros, 2 avisos)

## 5.5 Estado de validação e progresso
Etapa 4 ativa. Badge de status do projeto na biblioteca atualizado automaticamente após a exportação (via reactive state). Estado de "gerando" com progresso indeterminado até BFF retornar.

---

# TELA 08 — Download e Histórico

## 5.1 Objetivo
Confirmação de download e histórico de exportações do projeto. Editor pode baixar versões anteriores ou iniciar nova exportação após ajustes.

## 5.2 Estrutura visual

```
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │  TOPBAR: cordelê  Projetos / Romance das Cidades     │
│ ● Projetos ├──────────────────────────────────────────────────────┤
│   Novo     │                                                       │
│   projeto  │  Romance das Cidades                    ● Publicado  │
│            │  Eliana Moraes                                        │
│            │                                                       │
│            │  Histórico de exportações                            │
│            │  ─────────────────────────────────────────────────── │
│            │                                                       │
│            │  19/06/2026 16:30   ● Válido   1.4 MB   [ ↓ Baixar ]│
│            │  (versão atual)     0 erros · 2 avisos               │
│            │                                                       │
│            │  14/06/2026 09:15   ✕ Erros    —        (inválido)   │
│            │                     3 erros críticos                  │
│            │                                                       │
│            │  ─────────────────────────────────────────────────── │
│            │                                                       │
│            │  [ Ajustar metadados ]  [ Ajustar layout ]           │
│            │  [ Nova exportação ]                                  │
│            │                                                       │
└────────────┴──────────────────────────────────────────────────────┘
```

## 5.3 Componentes
- Header do projeto: título, autor, badge de status atual
- Lista de exportações: data/hora, status, tamanho, botão de download
- Links de ação: voltar a T05, T06, ou gerar nova exportação (aciona T07)
- Botão de download de cada versão (somente versões válidas)

## 5.4 Dados — bindings
- lê: ProjetoEditorial (nome, status)
- lê: Publicacao[] (histórico ordenado por criadoEm desc)
- lê: Metadados (autor)
- escreve: nenhum
- mock: publicacoes = Publicacao × 2 (uma válida, uma com erros)

## 5.5 Estado de validação e progresso
Barra de etapas não exibida (projeto concluído). Badge "Publicado" no header indica que última exportação foi bem-sucedida. Versões com erros mostram status mas sem botão de download.

---

## 6. Cobertura de Fluxos × Telas

| Fluxo (UI Concept §4) | Telas |
|---|---|
| 4.1 Importação e revisão de estrutura | T03 → T04 |
| 4.2 Configuração de metadados | T05 |
| 4.3 Visualização e ajuste de layout | T06 |
| 4.4 Exportação e validação | T07 |
| 4.5 Reabertura e reedição de projeto | T02 → T05/T06 → T07 |
| 4.6 Erro de parsing (tratamento de exceção) | T04 (painel de pendências) |

## 7. Cobertura de Componentes Técnicos × Telas (Framing §6)

| Componente (Framing §6) | Tela(s) |
|---|---|
| ManuscriptUploader | T03 |
| ManuscriptParser | T03 → T04 (resultado) |
| MetadataEditor | T05 |
| LayoutPreview | T06 |
| StyleController | T06 (painel de estilos) |
| EpubBuilder | T07 (geração) |
| EpubValidator | T07 (resultado) |
| ProjectRepository | T02, T08 |
| FileStorage | T03 (upload), T07 (download), T08 |
| BFFGateway | todos (camada invisível) |
| AuthModule | T01 (login), topbar (avatar/logout) |
