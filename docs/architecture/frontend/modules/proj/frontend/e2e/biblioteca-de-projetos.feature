# language: pt
# PROJ (Projetos) — T02 /biblioteca-de-projetos — biblioteca (home module), leitura server-authoritative
# Títulos carregam slugs em backtick (ex.: `proj-list-refetch`) para o matcher EARS->Gherkin
# (fe-ears-coverage): as cláusulas THE SYSTEM SHALL das SPECs referenciam os mesmos slugs.
Funcionalidade: Biblioteca de projetos
  Como editor autenticado com a permissão proj.view
  Quero ver todos os projetos da minha editora com o status atual
  Para retomar, baixar ou abrir cada projeto sem informação desatualizada

  Contexto:
    Dado que estou autenticado com uma empresa ativa e a permissão "proj.view"

  Cenario: Login leva à biblioteca como módulo home `proj-home-landing` `proj-contract-home` `proj-shell-home-redirect`
    Quando o login é concluído
    Entao o sistema navega para "/biblioteca-de-projetos" como módulo padrão pós-login

  Cenario: Shell registra o módulo Projetos `proj-shell-descriptor` `proj-shell-navconfig`
    Quando o shell inicializa
    Entao o sistema renderiza a entrada de menu "Projetos" a partir do descriptor
    E o sistema instala a navegação de PROJ com breadcrumbs e o resolver stage-aware de "Abrir"

  Cenario: Bootstrap não pré-carrega a lista `proj-shell-no-prefetch`
    Quando o módulo PROJ é inicializado no bootstrap
    Entao o sistema NAO busca a lista de projetos durante o bootstrap
    E o sistema busca a lista somente na entrada da rota

  Cenario: Sessão ausente redireciona para login `proj-guard-session`
    Dado que não tenho sessão válida
    Quando a rota "/biblioteca-de-projetos" é ativada
    Entao o sistema redireciona para o login e NAO renderiza nenhuma tela de PROJ

  Cenario: Empresa ausente bloqueia a rota `proj-guard-empresa`
    Dado que nenhuma empresa está ativa
    Quando a rota "/biblioteca-de-projetos" é ativada
    Entao o sistema bloqueia a rota até uma empresa ser selecionada

  Cenario: Permissão ausente nega acesso `proj-guard-permission` `proj-perm-accessdecision`
    Dado que não tenho a permissão "proj.view"
    Quando a rota "/biblioteca-de-projetos" é ativada
    Entao o sistema nega a rota e exibe feedback de acesso negado
    E o sistema avalia a permissão pelo AccessDecisionService, sem testar papéis no componente

  Cenario: Re-fetch a cada entrada, sem cache `proj-list-refetch`
    Quando eu entro na biblioteca e depois retorno de um módulo irmão
    Entao o sistema emite "GET /api/proj/projetos" em cada entrada
    E o sistema NAO serve a lista a partir de um cache de cliente

  Cenario: Troca de empresa cancela e re-busca `proj-empresa-switch`
    Dado que a lista está carregando para a empresa ativa
    Quando a empresa ativa muda
    Entao o sistema cancela a requisição de lista em andamento
    E o sistema re-emite a busca para a nova empresa

  Cenario: Ordenação por última atividade `proj-library-order`
    Quando a lista responde com vários projetos
    Entao o sistema ordena os cards por ultimaAtividadeEm em ordem decrescente

  Cenario: Skeleton durante o carregamento `proj-loading-skeleton`
    Quando a biblioteca está no estado de carregamento
    Entao o sistema exibe cards skeleton sem deslocamento de layout
    E o sistema NAO renderiza o estado vazio enquanto carrega

  Cenario: Estado vazio com CTA para importar `proj-empty-state`
    Quando a lista responde com zero projetos
    Entao o sistema define o estado como vazio
    E o sistema renderiza o CTA tracejado de estado vazio para o "/upload" do IMP

  Cenario: Derivação do badge de status `proj-badge-derivation`
    Dado um projeto que já possui uma publicação
    Entao o sistema deriva o badge do card a partir de ultimoEpubcheckStatus
    Dado um projeto sem publicação
    Entao o sistema deriva o badge do card a partir do status do projeto

  Cenario: Abrir stage-aware sem beco sem saída `proj-open-published` `proj-open-stage-aware`
    Quando eu aciono um card com status "publicado"
    Entao o sistema navega para "/projetos/{projetoId}/historico"
    Quando eu aciono um card com status "rascunho" ou "em_composicao"
    Entao o sistema resolve "Abrir" para a rota do IMP ou do COMP, nunca para o histórico

  Cenario: Download rápido por card via URL assinada `proj-flag-quickdownload` `proj-perm-download`
    Dado que tenho a permissão "proj.download" e a flag "proj.quickDownload" está ligada
    Quando eu aciono o download rápido de um card com publicação válida
    Entao o sistema resolve uma URL assinada e a abre diretamente, sem baixar os bytes pela aplicação
    Dado que a flag "proj.quickDownload" está desligada ou falta a permissão "proj.download"
    Entao o sistema NAO renderiza o atalho de download no card

  Cenario: Degradação parcial não derruba a biblioteca `proj-degraded-fields` `proj-degrade-not-fail`
    Quando um port de leitura cross-context está indisponível
    Entao o sistema mantém a identidade e o status de cada projeto renderizados
    E o sistema marca os campos ausentes como temporariamente indisponíveis
    E o sistema define degraded como verdadeiro sem entrar no estado de erro

  Cenario: Erro de acesso na leitura `proj-err-forbidden`
    Quando o backend responde "urn:cordele:proj:forbidden" com 403
    Entao o sistema substitui o conteúdo por um banner de acesso negado

  Cenario: Falha de leitura com retry e correlação `proj-err-read-5xx` `proj-err-correlation`
    Quando a leitura da lista retorna 5xx ou erro de rede
    Entao o sistema renderiza um estado de erro com o botão "Tentar novamente"
    E o sistema anexa o correlationId do interceptor ao erro
