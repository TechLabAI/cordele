# language: pt
# PROJ (Projetos) — T08 /projetos/:projetoId/historico — header + histórico de exportações, download e reopen
# Títulos carregam slugs em backtick (ex.: `proj-reopen-post`) para o matcher EARS->Gherkin
# (fe-ears-coverage): as cláusulas THE SYSTEM SHALL das SPECs referenciam os mesmos slugs.
Funcionalidade: Download e histórico de exportações
  Como editor autenticado com a permissão proj.view
  Quero ver o histórico de publicações de um projeto e baixar a versão válida
  Para recuperar o ePub e, quando preciso, reabrir o projeto para uma nova revisão

  Contexto:
    Dado que estou autenticado com uma empresa ativa e a permissão "proj.view"
    E que abro "/projetos/{projetoId}/historico" de um projeto existente

  Cenario: Carga paralela do header e do histórico `proj-history-load`
    Quando a rota do histórico é ativada
    Entao o sistema emite "GET /api/proj/projetos/{projetoId}" e "GET /api/proj/projetos/{projetoId}/publicacoes" em paralelo

  Cenario: Guarda de projeto pré-empta o 404 `proj-guard-projeto`
    Dado que o segmento ":projetoId" é malformado ou não pertence à empresa ativa
    Quando a rota "/projetos/:projetoId/historico" é ativada
    Entao o sistema roteia para o estado "Projeto não encontrado" com link para a biblioteca
    E o sistema NAO chama o endpoint de detalhe

  Cenario: Linha não baixável sem affordance `proj-row-nondownloadable`
    Dado uma publicação cujo arquivoUrl é nulo
    Entao o sistema define canDownload como falso para a linha
    E o sistema NAO renderiza uma affordance "Baixar" para ela

  Cenario: Download por URL assinada sem proxy `proj-download-signed`
    Dado uma publicação com arquivoUrl não nulo
    Quando eu aciono "Baixar" na linha
    Entao o sistema resolve uma URL assinada pelo endpoint de download
    E o sistema abre a URL diretamente e NAO busca nem armazena os bytes do artefato

  Cenario: Reabrir para revisão aciona reopen e vai ao COMP `proj-reopen-post`
    Dado que o status do projeto é "publicado" ou "com_erros"
    Quando eu confirmo "Ajustar metadados" ou "Ajustar layout"
    Entao o sistema envia "POST /api/proj/projetos/{projetoId}/reopen"
    E ao receber 200 o sistema navega para a rota do COMP ("/config" ou "/editor-de-layout-preview")

  Cenario: Ações de reopen desabilitadas enquanto em andamento `proj-reopen-pending`
    Dado que uma requisição de reopen está em andamento
    Entao o sistema mantém reopenPending verdadeiro
    E o sistema desabilita as ações "Ajustar metadados" e "Ajustar layout"

  Cenario: Visibilidade do reopen por status e permissão `proj-reopen-visibility` `proj-perm-reopen` `proj-flag-reopen`
    Dado que o status do header não é "publicado" nem "com_erros"
    Entao o sistema define canReopen como falso e oculta as ações de reopen
    Dado que falta a permissão "proj.reopen" ou a flag "proj.reopen" está desligada
    Entao o sistema NAO renderiza as ações de reopen

  Cenario: Reopen ilegal a partir de rascunho `proj-reopen-illegal` `proj-err-illegal-reopen`
    Dado um projeto em "rascunho"
    Quando o backend responde "urn:cordele:proj:illegal-status-transition" com 409 ao reopen
    Entao o sistema exibe um toast defensivo
    E o sistema mantém o status visível inalterado

  Cenario: Projeto não encontrado `proj-err-not-found`
    Quando o backend responde "urn:cordele:proj:not-found" com 404
    Entao o sistema renderiza o estado "Projeto não encontrado" com link para a biblioteca

  Cenario: Download de versão sem artefato `proj-err-artifact`
    Quando o backend responde "urn:cordele:proj:artifact-not-available" com 409 em um download
    Entao o sistema exibe feedback inline na linha
    E o sistema NAO altera nenhum estado

  Cenario: Histórico degradado do PUB `proj-err-degraded`
    Quando a resposta carrega degraded verdadeiro por indisponibilidade do PUB
    Entao o sistema renderiza a identidade e o status disponíveis
    E o sistema marca o histórico ausente como temporariamente indisponível sem entrar no estado de erro

  Cenario: Limpeza ao sair da tela `proj-shell-destroy`
    Quando eu saio da tela de histórico
    Entao o sistema cancela qualquer requisição de histórico em andamento
    E o sistema não deixa estado cross-module residual
