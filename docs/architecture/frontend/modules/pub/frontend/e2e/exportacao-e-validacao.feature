# language: pt
# PUB (Publicação) — T07 /projetos/:projetoId/exportacao-e-validacao
# Exportar ePub 3 + validar via epubcheck — progresso por polling limitado (POST 202 + GET status,
# Retry-After), SEM SSE e SEM long-request (api-contract D-N / ADR-PUB-001).
# Títulos carregam slugs em backtick (ex.: `pub-export-trigger`) para o matcher EARS->Gherkin
# (fe-ears-coverage): as cláusulas THE SYSTEM SHALL das SPECs referenciam os mesmos slugs.
Funcionalidade: Exportar e validar um ePub com veredito autoritativo do epubcheck
  Como Coordenadora Editorial autenticada com a permissão pub.export
  Quero disparar a geração do ePub e ver um veredito claro (válido/avisos/erros críticos)
  Para baixar um arquivo comprovadamente válido ou ser levada a corrigir o layout, sem terminal

  Contexto:
    Dado que estou autenticada com uma empresa ativa e a permissão "pub.export"
    E que o projeto está "em_composicao" com manuscrito importado e metadados completos
    E que estou na tela de exportação em "/projetos/{projetoId}/exportacao-e-validacao"

  Cenario: Disparo da exportação e polling até o estado terminal `pub-export-trigger` `pub-poll-status` `pub-poll-terminal`
    Quando eu disparo a exportação ao entrar na tela
    Entao o sistema envia exatamente um POST para "/api/pub/projetos/{projetoId}/publicacoes" com corpo vazio
    E o sistema recebe 202 com o publicacaoId e passa a consultar "/publicacoes/{publicacaoId}/status"
    E o sistema respeita o cabeçalho Retry-After entre as consultas e NAO abre conexão SSE nem long-request
    Quando o backend reporta status "publicado"
    Entao o sistema para de consultar e renderiza o veredito terminal

  Cenario: Build já em andamento é um no-op idempotente `pub-export-idempotent`
    Dado que já existe um build em andamento para o projeto
    Quando eu disparo a exportação novamente
    Entao o sistema adota a publicação em andamento retornada com 200
    E o sistema NAO inicia um segundo job de build

  Cenario: Progresso indeterminado enquanto gerando `pub-progress-indeterminate`
    Dado que o build está em "gerando"
    Entao o sistema exibe um indicador de progresso indeterminado
    E o sistema NAO exibe um percentual numérico de progresso

  Cenario: Veredito válido é renderizado, não computado `pub-verdict-rendered`
    Quando o backend responde status "publicado" com epubcheckStatus "valido"
    Entao o sistema renderiza o veredito exatamente como o epubcheckStatus retornado pelo pub-service
    E o sistema NAO decide válido ou erros no cliente

  Cenario: Avisos não bloqueiam a publicação `pub-avisos-nonblocking`
    Quando o backend responde status "publicado" com epubcheckStatus "avisos"
    Entao o sistema renderiza um sucesso baixável com a ressalva de avisos não bloqueantes
    E o sistema NAO trata a publicação como falha

  Cenario: Retomada do estado ao reentrar na tela `pub-resume-reentry`
    Dado que reentro na tela sem estado em memória
    Entao o sistema retoma a partir da publicação mais recente do histórico
    E o sistema NAO inicia um cronômetro cliente novo

  Cenario: "Baixar ePub" navega para o histórico `pub-nav-baixar-t08`
    Dado que o veredito é "valido" e o download está habilitado
    Quando eu aciono "Baixar ePub"
    Entao o sistema navega para "/projetos/{projetoId}/download-e-historico" do mesmo projeto

  Cenario: Exportação é server-autoritativa sem escrita otimista `pub-no-optimistic`
    Quando eu disparo a exportação
    Entao o sistema NAO aplica atualização otimista no veredito da publicação nem no status do projeto
    E o sistema só reflete o resultado após a confirmação do servidor

  Cenario: Manuscrito ausente bloqueia a exportação `pub-err-manuscript-missing`
    Quando o backend responde urn:cordele:pub:manuscript-missing
    Entao o sistema exibe um banner no card de exportação orientando importar o manuscrito no IMP
    E o sistema NAO navega para um resultado

  Cenario: Metadados incompletos bloqueiam a exportação `pub-err-metadata-incomplete`
    Quando o backend responde urn:cordele:pub:metadata-incomplete
    Entao o sistema exibe um banner orientando completar os metadados obrigatórios na composição

  Cenario: Falha ao avançar o status do projeto `pub-err-status-advance-failed`
    Quando o backend responde urn:cordele:pub:status-advance-failed
    Entao o sistema exibe um banner informando que o ePub foi gerado mas o status do projeto não pôde ser atualizado
    E o sistema preserva o traceId de correlação

  Cenario: Veredito de erros críticos não é toast de erro `pub-err-verdict-not-error`
    Quando o backend responde 200 com epubcheckStatus "erros_criticos"
    Entao o sistema renderiza o banner de resultado vermelho com o download bloqueado
    E o sistema NAO exibe um toast de erro HTTP

  Cenario: Falha de rede antes de existir publicação é retryável `pub-err-network-retry`
    Quando a requisição de exportação falha com erro de rede ou 5xx antes de existir uma publicação
    Entao o sistema exibe um banner retryável
    E o sistema NAO exibe um estado gerando fantasma

  Cenario: Publicação inexistente `pub-err-publicacao-not-found`
    Quando o backend responde urn:cordele:pub:publicacao-not-found
    Entao o sistema exibe um banner de não encontrado
    E o sistema NAO renderiza um resultado parcial

  Cenario: Acesso proibido exibe mensagem bloqueante `pub-err-forbidden`
    Quando o backend responde urn:cordele:pub:forbidden
    Entao o sistema exibe uma mensagem de permissão bloqueante e NAO retenta

  Cenario: Toda falha anexa o traceId de correlação `pub-err-trace-id`
    Dado que uma requisição do PUB falhou
    Entao o sistema anexa o traceId de correlação ao erro renderizado

  Esquema do Cenario: Guards de rota redirecionam quando a pré-condição falha `pub-guard-session` `pub-guard-empresa` `pub-guard-permission` `pub-guard-uuid` `pub-guard-status-export` `pub-guard-status-history`
    Dado que uma rota "/pub" é ativada com a pré-condição "<precondicao>" ausente ou inválida
    Entao o sistema redireciona para "<destino>" e NAO renderiza a tela do PUB nem dispara a exportação

    Exemplos:
      | precondicao              | destino                  |
      | sessão válida            | login                    |
      | empresa ativa            | seleção de empresa       |
      | permissão pub.export     | rota proibida            |
      | projetoId UUID           | biblioteca de projetos   |
      | status em_composicao     | visão do projeto         |
      | projeto com publicação   | estado vazio de histórico|

  Esquema do Cenario: Permissões e feature flags controlam visibilidade `pub-perm-export` `pub-perm-view` `pub-perm-download` `pub-flag-rexport` `pub-flag-pdf` `pub-perm-accessdecision`
    Dado que a capacidade "<capacidade>" está "<estado>"
    Entao o sistema "<efeito>" avaliando sempre via AccessDecisionService e sem testar papéis direto no componente

    Exemplos:
      | capacidade            | estado    | efeito                                                  |
      | permissão pub.export  | ausente   | oculta entradas de exportar e desabilita o disparo       |
      | permissão pub.view    | ausente   | não expõe navegação para o histórico                     |
      | permissão pub.download| ausente   | desabilita "Baixar ePub" mantendo a revisão do histórico |
      | flag pub.rexport      | off       | oculta "Nova exportação" em projeto publicado            |
      | flag pub.pdfExport    | off       | não expõe nenhuma ação de exportação em PDF              |

  Esquema do Cenario: Integração com o Shell registra e desmonta o módulo `pub-shell-descriptor` `pub-shell-nav-register` `pub-shell-unmount` `pub-empresa-cancel` `pub-shell-nohttp`
    Dado o ciclo de vida do módulo PUB no Shell no evento "<evento>"
    Entao o sistema "<efeito>"

    Exemplos:
      | evento                       | efeito                                                                              |
      | Shell monta o registro       | usa o PUB_MODULE_DESCRIPTOR como fonte da rota/menu/permissões e não hard-coda rotas  |
      | entrada lazy é ativada       | registra step-bar (etapa 4 Exportar) e breadcrumb via NavigationService              |
      | Shell desmonta o módulo      | desregistra a navegação e cancela o polling de status em andamento                  |
      | empresa ativa é trocada      | notifica a ExportFacade para cancelar o polling da empresa anterior                 |
      | integração em uso            | mantém o PubShellIntegrationService sem HttpClient direto e sem estado de negócio    |
