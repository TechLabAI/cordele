# language: pt
# IMP (Importação) — T04 /imp/manuscritos/:manuscritoId/revisao — revisão de estrutura
# Títulos carregam slugs em backtick para o matcher EARS->Gherkin (fe-ears-coverage).
Funcionalidade: Revisar a estrutura detectada do manuscrito
  Como Coordenadora Editorial
  Quero ver capítulos, imagens e trechos não parseados detectados
  Para confirmar a estrutura conscientemente, sabendo o que não foi reconhecido

  Contexto:
    Dado que estou autenticada com uma empresa ativa e a permissão "imp.review"

  Cenario: Hidratação direta a partir da resposta do POST sem GET extra `imp-hydrate-direct`
    Dado que acabei de importar um manuscrito com sucesso
    Quando a revisão de estrutura é aberta na sequência do 201
    Entao o sistema hidrata a revisão de estrutura direto do corpo da resposta
    E o sistema NAO faz um GET de acompanhamento

  Cenario: Contadores conferem com a resposta do manuscrito `imp-counters-match`
    Dado que a revisão de estrutura está carregada
    Entao o sistema mostra totalCapitulos, totalImagens e trechosNaoParseados exatamente como retornados

  Cenario: Painel de pendências é sempre renderizado `imp-pending-always`
    Dado que a estrutura detectada tem trechos não parseados
    Entao o sistema renderiza todos os trechos não parseados no painel de pendências
    E o sistema NAO oculta nem descarta o contador de pendências

  Cenario: Rótulo de fallback para motivo desconhecido `imp-reason-fallback`
    Dado que um trecho não parseado tem um motivo fora do enum conhecido
    Entao o sistema rotula o trecho como "Não classificado" em vez de rótulo em branco

  Cenario: Confirmar estrutura com pendências avança para composição `imp-confirm-pending`
    Dado que a revisão de estrutura está pronta com trechosNaoParseados maior que zero
    Entao o sistema mantém a ação "Confirmar estrutura" habilitada
    Quando eu confirmo a estrutura
    Entao o sistema navega para a rota de configuração do COMP passando o projetoId

  Cenario: Confirmar com zero capítulos exige aviso `imp-zero-chapters`
    Dado que a revisão de estrutura está pronta com totalCapitulos igual a zero
    Quando eu tento confirmar a estrutura
    Entao o sistema abre um modal de aviso antes de prosseguir

  Cenario: Ignorar trecho é otimista `imp-ignore-optimistic`
    Dado que a revisão de estrutura está pronta com um trecho não parseado
    Quando eu ignoro o trecho
    Entao o sistema marca o trecho como ignorado imediatamente no painel

  Cenario: Rollback de ignorar quando o servidor rejeita `imp-ignore-rollback`
    Dado que a revisão de estrutura está pronta e existe um endpoint de ignore no servidor
    E que ignorei um trecho de forma otimista
    Quando o servidor rejeita o ignore
    Entao o sistema reverte o trecho para não-ignorado e exibe um toast de feedback

  Cenario: Reimportar volta para o upload `imp-reimport-nav`
    Dado que a revisão de estrutura está pronta
    Quando eu aciono "Reimportar outro arquivo"
    Entao o sistema navega de volta para a tela de upload

  Cenario: Deep-link hidrata com um único GET sem polling `imp-deeplink-single-get`
    Dado que abro a rota de revisão diretamente pelo manuscritoId sem estado em memória
    Quando a rota de revisão é ativada
    Entao o sistema emite exatamente um GET no manuscritoId para hidratar
    E o sistema exibe skeletons de carregamento até ficar pronto
    E o sistema NAO faz polling

  Cenario: Isolamento por empresa em manuscrito de outra empresa `imp-not-found`
    Dado que abro a revisão com um manuscritoId de outra empresa
    Quando o backend responde urn:cordele:imp:not-found
    Entao o sistema exibe um banner de não encontrado
    E o sistema oferece voltar para a biblioteca de projetos
