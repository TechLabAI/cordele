# language: pt
# IMP (Importação) — T03 /imp/upload — upload + parse SÍNCRONO (ADR-IMP-001)
# Títulos carregam slugs em backtick (ex.: `imp-sync-post`) para o matcher EARS->Gherkin
# (fe-ears-coverage): as clausulas THE SYSTEM SHALL das SPECs referenciam os mesmos slugs.
Funcionalidade: Importar manuscrito com parsing síncrono
  Como Coordenadora Editorial autenticada com a permissão imp.import
  Quero enviar um manuscrito .docx ou .md e ver a estrutura detectada
  Para transformar o arquivo em um projeto com estrutura confirmável, sem caixa-preta

  Contexto:
    Dado que estou autenticada com uma empresa ativa e a permissão "imp.import"
    E que estou na tela de upload em "/imp/upload"

  Cenario: Importação síncrona de projeto novo com um único POST `imp-sync-post`
    Dado que informo o nome do projeto "Cordel do Sertão"
    E que seleciono um arquivo ".docx" válido dentro do limite de 50 MB
    Quando eu submeto a importação
    Entao o sistema envia exatamente um POST para "/api/imp/manuscripts" com o file e com projetoTitulo
    E o sistema exibe uma barra de progresso determinada durante o upload dos bytes
    E o sistema NAO faz polling e NAO usa parseJobId
    Quando o backend responde 201 com o manuscritoId e a estrutura
    E o sistema navega para "/imp/manuscritos/{manuscritoId}/revisao"

  Cenario: Indicador de análise indeterminado durante o parse `imp-parse-indeterminate`
    Dado que submeti uma importação válida
    Quando os bytes do arquivo terminaram de transferir mas a resposta ainda não chegou
    Entao o sistema exibe o indicador indeterminado "analisando estrutura…"
    E o sistema NAO exibe um percentual numérico de progresso
    E o sistema NAO emite nenhuma requisição adicional

  Cenario: Anexar manuscrito a um projeto existente pela rota aninhada `imp-bind-existing`
    Dado que abro a rota aninhada "/imp/projetos/{projetoId}/importar" de um projeto existente
    E que seleciono um arquivo ".md" válido
    Quando eu submeto a importação
    Entao o sistema envia o POST com o file e com projetoId
    E o sistema NAO envia projetoTitulo

  Cenario: Extensão de arquivo não suportada bloqueada no cliente `imp-unsupported-format`
    Quando eu seleciono um arquivo ".pdf"
    Entao o sistema exibe um erro inline na drop zone informando que só .docx ou .md são aceitos
    E o sistema NAO envia a requisição de upload

  Cenario: Arquivo acima do limite de 50 MB bloqueado no cliente `imp-file-too-large`
    Quando eu seleciono um arquivo acima de 50 MB
    Entao o sistema exibe um erro inline na drop zone informando o limite de 50 MB
    E o sistema NAO envia a requisição de upload

  Cenario: Vínculo de projeto inválido quando ambos são informados `imp-invalid-binding`
    Dado que informo o nome do projeto novo "Novo Cordel"
    E que também tenho um projetoId de projeto existente vinculado
    Quando eu submeto a importação
    Entao o sistema rejeita o vínculo de projeto no cliente e NAO envia a requisição

  Cenario: Botão de importar desabilitado sem nenhum vínculo de projeto `imp-submit-disabled`
    Dado que não informo nome de projeto novo nem seleciono projeto existente
    Mas que seleciono um arquivo válido
    Entao o sistema mantém o botão de importar desabilitado

  Cenario: Falha de parsing exibe banner e não navega `imp-parse-failed`
    Dado que informo o nome do projeto "Arquivo Corrompido"
    E que seleciono um arquivo ".docx" corrompido
    Quando eu submeto a importação
    E o backend responde urn:cordele:imp:parse-failed
    Entao o sistema exibe um banner de erro com a ação "Reimportar" no card de progresso
    E o sistema NAO navega para a revisão de estrutura

  Cenario: Projeto não encontrado mantém o arquivo para retentar `imp-projeto-not-found`
    Dado que submeti uma importação para um projetoId
    Quando o backend responde urn:cordele:imp:projeto-not-found
    Entao o sistema exibe um banner no card de progresso
    E o sistema mantém o arquivo informado para o editor apontar outro projeto

  Cenario: Timeout do upload cai no mesmo estado retryável do 5xx `imp-timeout`
    Dado que submeti uma importação e a resposta do servidor não chega
    Quando a requisição de upload excede o timeout configurado do cliente
    Entao o sistema exibe o banner retryável e NAO retenta o upload automaticamente
    E o sistema cancela a requisição

  Cenario: Troca de empresa cancela o upload em andamento `imp-empresa-cancel`
    Dado que submeti uma importação e o upload está em andamento
    Quando a empresa ativa é trocada
    Entao o sistema notifica a ImportFacade e cancela a requisição de upload em andamento
    E o sistema NAO hidrata a revisão de estrutura a partir da resposta tardia

  Cenario: Acesso proibido exibe mensagem bloqueante `imp-forbidden`
    Dado que estou sem a permissão exigida para a ação
    Quando o backend responde urn:cordele:imp:forbidden
    Entao o sistema exibe uma mensagem de permissão bloqueante e NAO retenta

  Cenario: Toda falha anexa o traceId de correlação `imp-trace-id`
    Dado que uma requisição do IMP falhou
    Entao o sistema anexa o traceId de correlação ao erro renderizado

  Esquema do Cenario: Guards de rota redirecionam quando a pré-condição falha `imp-guard-session` `imp-guard-empresa` `imp-guard-permission` `imp-guard-uuid`
    Dado que uma rota "/imp" é ativada com a pré-condição "<precondicao>" ausente ou inválida
    Entao o sistema redireciona para "<destino>" e NAO renderiza a tela do IMP nem envia a requisição de upload

    Exemplos:
      | precondicao        | destino               |
      | sessão válida      | login                 |
      | empresa ativa      | seleção de empresa    |
      | permissão imp.import | rota proibida       |
      | projetoId UUID     | biblioteca de projetos|

  Esquema do Cenario: Permissões e feature flags controlam visibilidade `imp-flag-import` `imp-flag-review` `imp-flag-confirm` `imp-flag-ignore` `imp-flag-reimport` `imp-flag-existing` `imp-flag-accessdecision`
    Dado que a capacidade "<capacidade>" está "<estado>"
    Entao o sistema "<efeito>" avaliando sempre via AccessDecisionService e sem testar papéis direto no componente

    Exemplos:
      | capacidade            | estado    | efeito                                             |
      | permissão imp.import  | ausente   | oculta entradas de importar e desabilita o submit  |
      | permissão imp.review  | ausente   | não expõe navegação para a revisão de estrutura    |
      | permissão imp.confirm | ausente   | desabilita "Confirmar estrutura" mantendo a revisão|
      | flag imp.ignoreFragment | off     | oculta a ação "Ignorar" por trecho                 |
      | flag imp.reimport     | off       | oculta "Reimportar outro arquivo"                  |
      | flag imp.existingProject | off    | não expõe a rota de anexar a projeto existente     |

  Esquema do Cenario: Integração com o Shell registra e desmonta o módulo `imp-shell-descriptor` `imp-shell-nav-register` `imp-shell-unmount` `imp-shell-nohttp`
    Dado o ciclo de vida do módulo IMP no Shell no evento "<evento>"
    Entao o sistema "<efeito>"

    Exemplos:
      | evento                       | efeito                                                                                  |
      | Shell monta o registro       | usa o IMP_MODULE_DESCRIPTOR como fonte da rota/menu/permissões e não hard-coda rotas     |
      | entrada lazy é ativada       | registra step-bar e breadcrumb via NavigationService                                    |
      | Shell desmonta o módulo      | desregistra a navegação e cancela a subscription de upload em andamento                 |
      | integração em uso            | mantém o ImpShellIntegrationService sem HttpClient direto e sem estado de negócio        |
