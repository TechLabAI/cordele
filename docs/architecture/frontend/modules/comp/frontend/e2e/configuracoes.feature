# language: pt
# COMP (Composição) — T05 /projetos/:projetoId/config — metadados do livro, capa, avanço pessimista
# Títulos carregam slugs em backtick (ex.: `comp-meta-hydrate`) para o matcher EARS->Gherkin
# (fe-ears-coverage): as cláusulas THE SYSTEM SHALL das SPECs referenciam os mesmos slugs.
Funcionalidade: Configuração de metadados
  Como editor autenticado com a permissão comp.view
  Quero informar título, autor, idioma e capa de um projeto em composição
  Para prosseguir ao editor de layout com os metadados persistidos

  Contexto:
    Dado que estou autenticado com uma empresa ativa e a permissão "comp.view"
    E que abro "/projetos/{projetoId}/config" de um projeto em composição

  Cenario: Sessão ausente redireciona para login `comp-guard-session`
    Dado que não tenho sessão válida
    Quando a rota "/projetos/{projetoId}/config" é ativada
    Entao o sistema redireciona para o login e NAO renderiza nenhuma tela de COMP

  Cenario: Empresa ausente bloqueia a rota `comp-guard-empresa`
    Dado que nenhuma empresa está ativa
    Quando a rota "/projetos/{projetoId}/config" é ativada
    Entao o sistema bloqueia a rota até uma empresa ser selecionada

  Cenario: Permissão ausente nega acesso `comp-guard-permission` `comp-perm-accessdecision`
    Dado que não tenho a permissão "comp.view"
    Quando a rota "/projetos/{projetoId}/config" é ativada
    Entao o sistema nega a rota e exibe feedback de acesso negado
    E o sistema avalia a permissão pelo AccessDecisionService, sem testar papéis no componente

  Cenario: Guarda de projeto pré-empta o 404 `comp-guard-projeto`
    Dado que o segmento ":projetoId" é malformado ou não pertence à empresa ativa
    Quando a rota "/projetos/:projetoId/config" é ativada
    Entao o sistema roteia para o estado "Projeto não encontrado" com link para a biblioteca
    E o sistema NAO chama nenhum endpoint do comp-service

  Cenario: Guarda de status redireciona projeto fora de composição `comp-guard-status`
    Dado que o projeto referenciado não está em "em_composicao"
    Quando a rota "/projetos/{projetoId}/config" é ativada
    Entao o sistema redireciona de volta para o PROJ e NAO abre a tela de COMP

  Cenario: Hidratação com default lazy `comp-meta-hydrate`
    Quando a tela de configuração é aberta
    Entao o sistema hidrata o formulário a partir de "GET /api/comp/projetos/{projetoId}/metadados"
    E quando a representação vem com materialized=false o sistema usa defaults com idioma "pt"

  Cenario: Campos obrigatórios travam o avanço `comp-meta-required`
    Quando o título, o autor ou o idioma estão inválidos
    Entao o sistema mantém canAdvance falso e desabilita o botão "Ir para preview"

  Cenario: Re-fetch a cada entrada, sem cache `comp-meta-refetch`
    Quando eu entro na configuração e depois retorno de outra tela
    Entao o sistema emite "GET /api/comp/projetos/{projetoId}/metadados" em cada entrada
    E o sistema NAO serve os metadados a partir de um cache de cliente

  Cenario: Avanço pessimista persiste antes de navegar `comp-advance-persist` `comp-no-optimistic`
    Dado que os campos obrigatórios estão válidos
    Quando eu aciono "Ir para preview"
    Entao o sistema emite "PUT /api/comp/projetos/{projetoId}/metadados" e aguarda 200 antes de navegar para o T06
    E quando o PUT falha o sistema interrompe o avanço e preserva as edições locais

  Cenario: Upload e remoção de capa `comp-cover-upload` `comp-cover-remove`
    Dado que tenho a permissão "comp.edit"
    Quando eu seleciono uma imagem suportada dentro do limite de tamanho
    Entao o sistema emite "POST /api/comp/projetos/{projetoId}/capa" e troca a object-URL pela capaUrl retornada
    Quando eu removo a capa
    Entao o sistema emite "DELETE /api/comp/projetos/{projetoId}/capa" e limpa a capaUrl de forma idempotente

  Cenario: Capa com formato inválido `comp-err-cover-format`
    Quando o backend responde "urn:cordele:comp:unsupported-cover-format" com 415
    Entao o sistema exibe um erro inline na área de upload listando os formatos aceitos
    E o sistema mantém o restante do formulário intacto

  Cenario: Capa acima do limite `comp-err-cover-size`
    Quando o backend responde "urn:cordele:comp:cover-too-large" com 413
    Entao o sistema exibe um erro inline na área de upload informando o limite de tamanho
    E o sistema mantém o restante do formulário intacto

  Cenario: Gating por permissão de edição `comp-perm-edit`
    Dado que não tenho a permissão "comp.edit"
    Entao o sistema oculta ou desabilita o avanço e as ações de capa

  Cenario: Flag desliga o upload de capa `comp-flag-coverupload`
    Dado que a flag "comp.coverUpload" está desligada
    Entao o sistema NAO renderiza a área de upload de capa no T05

  Cenario: Validação defensiva do upsert `comp-err-validation`
    Quando o backend responde "urn:cordele:comp:validation" com 400 no upsert de metadados
    Entao o sistema exibe erros inline nos campos e NAO navega para o T06

  Cenario: Erro de acesso na leitura `comp-err-forbidden`
    Quando o backend responde "urn:cordele:comp:forbidden" com 403
    Entao o sistema substitui o conteúdo por um banner de acesso negado

  Cenario: Projeto não encontrado `comp-err-not-found`
    Quando o backend responde "urn:cordele:comp:projeto-not-found" com 404
    Entao o sistema roteia para o estado "Projeto não encontrado" com link para a biblioteca

  Cenario: Falha de leitura com retry e correlação `comp-err-read-5xx` `comp-err-correlation`
    Quando a leitura dos metadados retorna 5xx ou erro de rede
    Entao o sistema renderiza um estado de erro com o botão "Tentar novamente"
    E o sistema anexa o correlationId do interceptor ao erro

  Cenario: Integração com o shell `comp-shell-descriptor` `comp-shell-navconfig` `comp-shell-no-prefetch` `comp-shell-destroy`
    Quando o shell inicializa
    Entao o sistema registra o COMP_MODULE_DESCRIPTOR e carrega COMP de forma lazy sem adicionar entrada no menu de topo
    E o sistema instala o COMP_NAV_CONFIG com as posições da barra de etapas e os breadcrumbs
    E o sistema NAO pré-carrega metadados durante o bootstrap
    E quando COMP é destruído o sistema cancela requisições em andamento e não deixa estado cross-module
