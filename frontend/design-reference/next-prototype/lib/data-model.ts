// Data model — gerado por wireframe-to-react (DESCARTÁVEL)

export interface ProjetoEditorial {
  id: string
  nome?: string
  status?: ''rascunho'|'em_composicao'|'publicado'|'com_erros''
  criadoEm?: string
  ultimaAtividade?: string
  editora?: Editora
}

export interface Manuscrito {
  id: string
  projetoId?: ProjetoEditorial
  nomeArquivo?: string
  formato?: ''docx'|'markdown''
  totalCapitulos?: number
  totalImagens?: number
  trechosNaoParseados?: number
  estrutura?: string
}

export interface Metadados {
  id: string
  projetoId?: ProjetoEditorial
  titulo?: string
  autor?: string
  isbn?: string
  idioma?: ''pt'|'en'|'es'|'fr''
  categoria?: string
  capaUrl?: string
  editoraNome?: string
}

export interface ConfiguracaoLayout {
  id: string
  projetoId?: ProjetoEditorial
  fonteCorpoFamilia?: ''serif'|'sans-serif''
  fonteCorpoTamanho?: number
  espacamentoLinha?: number
  margemLateral?: number
  h1Tamanho?: number
  h2Tamanho?: number
  h3Tamanho?: number
}

export interface Publicacao {
  id: string
  projetoId?: ProjetoEditorial
  arquivoUrl?: string
  epubcheckStatus?: ''valido'|'avisos'|'erros_criticos'|'pendente''
  totalErros?: number
  totalAvisos?: number
  erros?: string
  criadoEm?: string
}

export interface Editora {
  id: string
  nome?: string
  email?: string
}
