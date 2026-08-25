# language: pt
# COMP (Composição) — T06 /projetos/:projetoId/editor-de-layout-preview — painel de estilos + preview + exportar
# Títulos carregam slugs em backtick (ex.: `comp-layout-hydrate`) para o matcher EARS->Gherkin
# (fe-ears-coverage): as cláusulas THE SYSTEM SHALL das SPECs referenciam os mesmos slugs.
Funcionalidade: Editor de layout e preview
  Como editor autenticado com a permissão comp.view
  Quero ajustar tipografia, margens e alinhamento de imagens vendo um preview aproximado
  Para exportar o projeto com os parâmetros que o ePub honra, sem alterar o status

  Contexto:
    Dado que estou autenticado com uma empresa ativa e a permissão "comp.view"
    E que abro "/projetos/{projetoId}/editor-de-layout-preview" de um projeto em composição

  Cenario: Hidratação com default lazy e carga paralela `comp-layout-hydrate` `comp-layout-refetch`
    Quando a tela do editor é aberta
    Entao o sistema emite "GET /api/comp/projetos/{projetoId}/layout" e "GET /api/comp/projetos/{projetoId}/preview-context" em paralelo
    E quando o layout vem com materialized=false o sistema usa a configuração padrão
    E o sistema NAO serve layout ou preview a partir de um cache de cliente

  Cenario: Limites e ordem de headings no painel `comp-layout-bounds`
    Quando eu ajusto um valor do painel de estilos fora do seu limite
    Entao o sistema fixa o valor ao limite permitido
    E o sistema mantém h1Tamanho maior ou igual a h2Tamanho maior ou igual a h3Tamanho

  Cenario: Preview página-a-página sem chamada de rede `comp-preview-paginate`
    Quando eu troco a página atual do preview
    Entao o sistema renderiza exatamente uma página por vez
    E o sistema NAO emite chamada de rede ao trocar de página

  Cenario: Override obsoleto é excluído `comp-stale-override`
    Dado que o preview-context marca um override como stale
    Entao o sistema exclui esse override do preview aplicado e do payload persistido
    E o sistema exibe um aviso não bloqueante sobre o override obsoleto

  Cenario: Edição local e write-back de alinhamento `comp-no-optimistic` `comp-alignment-writeback`
    Quando eu altero a tipografia e o alinhamento de uma imagem
    Entao o sistema atualiza o preview localmente sem nenhuma chamada de rede
    E o sistema grava o conjunto de overrides de alinhamento apenas junto do upsert de layout na exportação

  Cenario: Exportar pessimista sem mudar status `comp-export-persist` `comp-nav-export`
    Quando eu aciono "Exportar"
    Entao o sistema emite "PUT /api/comp/projetos/{projetoId}/layout" com os overrides de alinhamento não obsoletos e aguarda 200
    E o sistema navega para o PUB "/exportacao-e-validacao" levando o projetoId
    E o sistema NAO altera o status do projeto
    E quando o PUT falha o sistema interrompe a navegação e preserva as edições locais

  Cenario: Toolbar apenas de alinhamento `comp-toolbar-alignment-only` `comp-honoured-params-only`
    Quando a barra de ferramentas do T06 é renderizada
    Entao o sistema NAO renderiza controles de adicionar página, remover página ou inserir imagem
    E o sistema expõe no painel de estilos apenas os parâmetros que o stylesheet do PUB honra

  Cenario: Gating por permissão de edição `comp-perm-edit`
    Dado que não tenho a permissão "comp.edit"
    Entao o sistema oculta ou desabilita a exportação e o controle de alinhamento de imagem

  Cenario: Flag desliga o alinhamento de imagem `comp-flag-imagealignment`
    Dado que a flag "comp.imageAlignment" está desligada
    Entao o sistema NAO renderiza o controle de alinhamento por imagem no T06

  Cenario: Preview sem manuscrito mostra estado vazio `comp-err-manuscript-missing`
    Quando o backend responde "urn:cordele:comp:manuscript-missing" com 409 no preview-context
    Entao o sistema exibe o estado vazio do preview "nada para pré-visualizar"
    E o sistema mantém o painel de estilos utilizável

  Cenario: Override referenciando nó ausente `comp-err-override-ref`
    Quando o backend responde "urn:cordele:comp:override-ref-not-found" com 422 na exportação
    Entao o sistema exibe um toast defensivo e preserva as edições locais

  Cenario: Edição estrutural diferida é inalcançável `comp-err-structural-deferred`
    Quando o backend responde "urn:cordele:comp:structural-edit-deferred" com 422
    Entao o sistema exibe um toast defensivo, caminho inalcançável enquanto a toolbar é apenas de alinhamento
