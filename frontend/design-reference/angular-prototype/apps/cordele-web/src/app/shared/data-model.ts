// =============================================================================
// data-model.ts — gerado por wireframe-to-angular (camada de contrato).
// Fonte: design/data-model.json (draft (BA)). NÃO editar à mão — regenerar via:
//   python main.py <projeto> --force
// =============================================================================


export type ProjetoEditorialStatus = 'rascunho' | 'em_composicao' | 'publicado' | 'com_erros';
export type ManuscritoFormato = 'docx' | 'markdown';
export type MetadadosIdioma = 'pt' | 'en' | 'es' | 'fr';
export type ConfiguracaoLayoutFonteCorpoFamilia = 'serif' | 'sans-serif';
export type PublicacaoEpubcheckStatus = 'valido' | 'avisos' | 'erros_criticos' | 'pendente';

/** Projeto editorial — agrupa manuscrito, metadados e publicações */
export interface ProjetoEditorial {
  id: string;  // string
  nome: string;  // string
  status: ProjetoEditorialStatus;  // enum
  criadoEm: string;  // datetime
  ultimaAtividade: string | null;  // datetime
  editora: string;  // ref → Editora
}

/** Arquivo original parseado — imutável após import */
export interface Manuscrito {
  id: string;  // string
  projetoId: string;  // ref → ProjetoEditorial
  nomeArquivo: string;  // string
  formato: ManuscritoFormato;  // enum
  totalCapitulos: number;  // int
  totalImagens: number;  // int
  trechosNaoParseados: number;  // int
  estrutura: string;  // string
}

/** Metadados editoriais configurados pelo editor */
export interface Metadados {
  id: string;  // string
  projetoId: string;  // ref → ProjetoEditorial
  titulo: string;  // string
  autor: string;  // string
  isbn: string | null;  // string
  idioma: MetadadosIdioma;  // enum
  categoria: string | null;  // string
  capaUrl: string | null;  // string
  editoraNome: string | null;  // string
}

/** Ajustes de estilo do editor */
export interface ConfiguracaoLayout {
  id: string;  // string
  projetoId: string;  // ref → ProjetoEditorial
  fonteCorpoFamilia: ConfiguracaoLayoutFonteCorpoFamilia;  // enum
  fonteCorpoTamanho: number;  // int
  espacamentoLinha: number;  // decimal
  margemLateral: number;  // int
  h1Tamanho: number;  // int
  h2Tamanho: number;  // int
  h3Tamanho: number;  // int
}

/** Registro de cada exportação de ePub */
export interface Publicacao {
  id: string;  // string
  projetoId: string;  // ref → ProjetoEditorial
  arquivoUrl: string | null;  // string
  epubcheckStatus: PublicacaoEpubcheckStatus;  // enum
  totalErros: number;  // int
  totalAvisos: number;  // int
  erros: string | null;  // string
  criadoEm: string;  // datetime
}

/** Conta da editora (tenant simplificado para POC) */
export interface Editora {
  id: string;  // string
  nome: string;  // string
  email: string;  // string
}
