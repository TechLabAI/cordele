# language: pt
# PUB (Publicação) — T08 /projetos/:projetoId/download-e-historico
# Histórico de publicações (newest-first) + download por URL assinada de curta duração (a SPA nunca
# transmite os bytes) + KPIs do read-model ao vivo (api-contract §4.3/§4.4/§4.5, D-F/D-O/D-Q).
# Títulos carregam slugs em backtick para o matcher EARS->Gherkin (fe-ears-coverage).
Funcionalidade: Baixar o ePub e navegar pelo histórico de exportações
  Como Coordenadora Editorial autenticada com as permissões pub.view e pub.download
  Quero ver todas as publicações do projeto e baixar a versão válida que eu escolher
  Para distribuir o arquivo certo e reencontrar qualquer exportação anterior

  Contexto:
    Dado que estou autenticada com uma empresa ativa e as permissões "pub.view" e "pub.download"
    E que o projeto possui ao menos uma publicação
    E que estou na tela de histórico em "/projetos/{projetoId}/download-e-historico"

  Cenario: Histórico mais recente primeiro com a versão atual marcada `pub-versao-atual`
    Quando o sistema carrega "/api/pub/projetos/{projetoId}/publicacoes"
    Entao o sistema renderiza as publicações na ordem do servidor, da mais recente para a mais antiga
    E o sistema marca a publicação de índice 0 como "versão atual"
    E o sistema NAO reordena nem muta os registros

  Cenario: KPIs vêm do endpoint de stats `pub-stats-live`
    Quando o sistema carrega a tela
    Entao o sistema computa os cartões de KPI a partir de "/api/pub/projetos/{projetoId}/publicacoes/stats"
    E o sistema NAO usa uma fonte de analytics separada

  Cenario: Tile de resumo do ePub ausente é omitido `pub-kpi-omit-missing`
    Dado que o contrato não fornece um campo de resumo do ePub (ex.: Páginas)
    Entao o sistema omite esse tile
    E o sistema NAO renderiza um valor fabricado

  Cenario: Download de publicação válida via URL assinada `pub-download-signed-url`
    Dado que uma publicação tem epubcheckStatus "valido"
    Quando eu aciono "Baixar"
    Entao o sistema solicita uma URL assinada de curta duração em "/publicacoes/{publicacaoId}/download"
    E o sistema abre a URL diretamente
    E o sistema NAO transmite os bytes do arquivo através da aplicação

  Cenario: Gate de download bloqueia publicações inválidas `pub-gate-download`
    Dado que uma publicação tem epubcheckStatus "erros_criticos" e arquivoUrl nulo
    Entao o sistema renderiza a linha como "inválido"
    E o sistema NAO habilita o download para essa linha

  Cenario: Link de download expirado é renovado `pub-download-expired-refetch`
    Dado que a URL assinada de download expirou ou foi rejeitada
    Quando eu aciono "Baixar"
    Entao o sistema re-solicita uma URL assinada nova
    E o sistema NAO cai para um link público de bucket

  Cenario: Artefato indisponível exibe erro inline `pub-err-artifact-not-available`
    Quando o backend responde urn:cordele:pub:artifact-not-available
    Entao o sistema exibe um erro inline no controle de download
    E o sistema mantém o download desabilitado
