// =============================================================================
// mock-data.ts — gerado por wireframe-to-angular (camada de contrato).
// Fonte: design/mock-data.json — NUNCA editar à mão; regenerar via:
//   python main.py <projeto> --force
// =============================================================================

import { ProjetoEditorial, Manuscrito, Metadados, Publicacao } from './data-model';

export const nenhum: Array<Record<string, unknown>> = [];

export const projetos: ProjetoEditorial[] = [
  { id: 'proj-001', nome: 'Romance das Cidades', status: 'publicado',    criadoEm: '2026-06-01T09:00:00', ultimaAtividade: '2026-06-19T16:30:00', editora: 'Editora Aetós' },
  { id: 'proj-002', nome: 'Poemas do Sertão',    status: 'em_composicao', criadoEm: '2026-06-10T11:00:00', ultimaAtividade: '2026-06-14T09:15:00', editora: 'Editora Aetós' },
  { id: 'proj-003', nome: 'Contos Urbanos',       status: 'rascunho',      criadoEm: '2026-06-18T14:00:00', ultimaAtividade: '2026-06-18T14:05:00', editora: 'Editora Aetós' },
];

export const manuscrito: Manuscrito[] = [
  {
    id: 'ms-001', projetoId: 'proj-001',
    nomeArquivo: 'romance-das-cidades.docx', formato: 'docx',
    totalCapitulos: 18, totalImagens: 3, trechosNaoParseados: 2,
    estrutura: 'Capítulo 1 — O Rio\nCapítulo 2 — A Cidade\nCapítulo 3 — O Retorno\nCapítulo 4 — O Mercado\nCapítulo 5 — A Noite',
  },
];

export const metadados: Metadados[] = [
  {
    id: 'meta-001', projetoId: 'proj-001',
    titulo: 'Romance das Cidades', autor: 'Eliana Moraes',
    isbn: '978-65-00123-45-6', idioma: 'pt',
    categoria: 'Romance contemporâneo', capaUrl: null, editoraNome: 'Editora Aetós',
  },
];

export const publicacao: Publicacao[] = [
  {
    id: 'pub-001', projetoId: 'proj-001',
    arquivoUrl: '/exports/romance-das-cidades-v2.epub',
    epubcheckStatus: 'avisos', totalErros: 0, totalAvisos: 2,
    erros: null, criadoEm: '2026-06-19T16:30:00',
  },
];

export const publicacoes: Publicacao[] = [
  {
    id: 'pub-001', projetoId: 'proj-001',
    arquivoUrl: '/exports/romance-das-cidades-v2.epub',
    epubcheckStatus: 'avisos', totalErros: 0, totalAvisos: 2,
    erros: null, criadoEm: '2026-06-19T16:30:00',
  },
  {
    id: 'pub-000', projetoId: 'proj-001',
    arquivoUrl: null,
    epubcheckStatus: 'erros_criticos', totalErros: 3, totalAvisos: 0,
    erros: 'OPS-001: spine item não encontrado (capítulo 17); META-001: identifier ausente; CSS-001: propriedade border-collapse não suportada em ePub 3',
    criadoEm: '2026-06-14T09:15:00',
  },
];
