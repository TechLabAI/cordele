# UI Concept — Cordelê

> **Última atualização:** 2026-06-19
> **Status:** rascunho

---

## 1. Intenção

O Cordelê deve transmitir a sensação de uma **mesa de montagem editorial digital** — limpa, focada, onde o manuscrito entra bruto e sai publicação. A interface não disputa atenção com o conteúdo: ela recua e serve.

A experiência é desenhada para um coordenador editorial que já passou horas brigando com Calibre, Sigil ou InDesign para publicar um ePub que a plataforma de distribuição aceitasse. O Cordelê deve parecer a ferramenta que deveria ter existido desde sempre: sem instalação, sem terminal, sem HTML na mão — só o manuscrito e o resultado.

---

## 2. Princípios de UX

Cada princípio é **acionável**: alguém deve poder olhar uma tela e dizer "isso viola o princípio N".

### 2.1 O conteúdo do autor nunca some ou se transforma sem aviso
O sistema nunca modifica texto silenciosamente. Se o parser não conseguiu interpretar um trecho, ele é marcado visivelmente — nunca descartado sem rastro.

**Como verificar:** ao importar um DOCX com formatação incomum, o usuário vê exatamente o que foi parseado e o que ficou pendente. Nenhum parágrafo desaparece silenciosamente.

### 2.2 O editor vê o resultado antes de exportar
O preview não é decorativo — é o critério de aceite do editor. A visualização página a página deve refletir fielmente o ePub que será gerado, incluindo tipografia, hierarquia e imagens.

**Como verificar:** o que aparece no preview deve ser idêntico ao que aparece no leitor de ePub após a exportação. Divergência entre preview e arquivo exportado é bug crítico.

### 2.3 Erros de validação são explicados, não apenas listados
Quando o epubcheck retorna erros, o sistema mostra: o que é, onde está no manuscrito, e o que fazer. Nunca um código de erro solto sem contexto.

**Como verificar:** ao clicar num erro de validação, o usuário é levado ao trecho do manuscrito ou metadado que o causou. Se isso não acontece, o princípio foi violado.

### 2.4 Cada passo tem um próximo passo claro
O fluxo é linear: importar → configurar → visualizar → exportar. Em nenhuma tela o usuário fica sem saber o que fazer em seguida.

**Como verificar:** toda tela tem exatamente um CTA primário proeminente. Se há dois CTAs de mesmo peso visual em competição, o princípio foi violado.

### 2.5 A ferramenta é transparente sobre o que faz e não faz
O Cordelê formata e exporta — não edita texto. Essa fronteira é visível na interface: o campo de texto nunca é editável dentro do Cordelê.

**Como verificar:** não existe campo de texto editável no corpo do manuscrito dentro do sistema. Se aparecer, o princípio foi violado.

### 2.6 Estado de validação sempre visível
O usuário sabe, em qualquer momento, se o projeto está pronto para exportar ou tem pendências. Esse estado aparece de forma persistente — não apenas após tentar exportar.

**Como verificar:** o indicador de status do projeto (válido / pendências / erros) aparece no header ou na barra de progresso sem o usuário precisar acionar nenhuma ação.

---

## 3. Personas em jornada

### 3.1 Jornada — Marina (Coordenadora Editorial)

```
Manhã (escritório da editora, após reunião com autora)
  → Recebe manuscrito final em DOCX por e-mail
  → Abre o Cordelê no browser
  → Cria novo projeto: "Romance X — Aetós 2026"
  → Faz upload do DOCX
  → Sistema parseia e mostra a estrutura: 18 capítulos detectados,
    1 imagem, 2 trechos com formatação não reconhecida (marcados)
  → Revisa os 2 trechos marcados — decide ignorar (são notas de revisão)
  → Preenche metadados: título, nome da autora, ISBN, idioma, capa
  → Abre o preview: vê o livro página a página no browser
  → Ajusta espaçamento entre parágrafos (estava muito compacto)
  → Clica em "Exportar ePub"
  → Sistema roda epubcheck: 0 erros, 2 avisos (aceitos)
  → Baixa o arquivo .epub
  → Faz upload direto na Amazon KDP
  → Título publicado em 40 minutos — antes levava 2 dias com diagramador
```

**Frequência de uso:** por título publicado (variável — pode ser diária em picos)
**Dispositivo principal:** notebook (desktop web)
**Objetivo dominante:** entregar ePub válido com autonomia e rapidez

---

## 4. Fluxos principais

### 4.1 Fluxo — Importação e revisão de estrutura (fluxo de entrada)

```
1. Usuário cria novo projeto editorial (nome + editora)
2. Faz upload do arquivo (DOCX ou Markdown)
3. Sistema parseia e exibe estrutura detectada:
   - N capítulos encontrados
   - Imagens referenciadas
   - Trechos com formatação não reconhecida (marcados em amarelo)
4. Usuário revisa trechos marcados: confirma, ignora ou marca para correção
5. Estrutura confirmada → projeto avança para Configuração
```

### 4.2 Fluxo — Configuração de metadados

```
1. Usuário preenche campos obrigatórios: título, autor, idioma
2. Usuário faz upload da imagem de capa
3. Campos opcionais: ISBN, editora, categoria, data de publicação
4. Sistema indica campos obrigatórios faltantes com destaque visual
5. Todos preenchidos → CTA "Ir para preview" habilitado
```

### 4.3 Fluxo — Visualização e ajuste de layout

```
1. Usuário entra no preview página a página
2. Vê o manuscrito renderizado com os estilos padrão aplicados
3. Abre painel de estilos: tipografia (família, tamanho), espaçamento,
   hierarquia de títulos (H1/H2/H3), margens
4. Ajusta um parâmetro → preview atualiza em tempo real
5. Navega entre páginas para verificar resultado
6. Satisfeito → clica em "Exportar"
```

### 4.4 Fluxo — Exportação e validação

```
1. Usuário aciona exportação
2. Sistema gera estrutura ePub 3 internamente
3. Executa epubcheck automaticamente
4. SE sem erros críticos:
   → Exibe resumo: "ePub válido — N páginas, N imagens, N avisos"
   → Botão de download habilitado
5. SE com erros críticos:
   → Lista erros com descrição e localização no manuscrito
   → Usuário corrige (na fonte ou via ajuste de metadados) e re-exporta
6. Download do arquivo .epub
```

### 4.5 Fluxo — Reabertura e reedição de projeto

```
1. Usuário acessa biblioteca de projetos
2. Seleciona projeto anterior
3. Vê histórico: data de criação, última exportação, status de validação
4. Reabre no estado em que estava (metadados + estilos preservados)
5. Faz nova exportação (ex.: após o autor enviar versão corrigida do manuscrito)
```

### 4.6 Fluxo — Erro de parsing (tratamento de exceção)

```
1. Upload de DOCX com formatação complexa (tabelas, caixas de texto, etc.)
2. Parser identifica elementos não suportados
3. Sistema exibe: "X elementos não foram parseados — veja detalhes"
4. Usuário vê lista de elementos ignorados com posição aproximada no manuscrito
5. Decide: prosseguir sem eles ou corrigir o DOCX na origem e reimportar
6. Nenhum dado é perdido silenciosamente
```

---

## 5. Tom visual de alto nível

- **Densidade:** confortável — espaçamento editorial, não dashboard compacto. O manuscrito merece respiro.
- **Cromática:** clara, neutra, com acentos sutis. Fundo branco ou off-white. Tipografia como elemento de design. Sem neon, sem escuro. O texto do manuscrito é o protagonista visual.
- **Referências visuais:**
  - [Notion](https://notion.so) — limpeza, hierarquia tipográfica como interface
  - [iA Writer](https://ia.net/writer) — foco no conteúdo, interface que recua
  - [Ulysses](https://ulysses.app) — publisher com preview lateral, sensação de ferramenta editorial profissional
