import { inflateRawSync } from 'node:zlib';

import { EpubBuilder, type EpubContentTree, type EpubMetadados, type EpubLayout } from './epub-builder';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minimalTree(projetoId = 'proj-1'): EpubContentTree {
  return {
    manuscritoId: `manuscrito-${projetoId}`,
    estrutura: [
      {
        type: 'chapter',
        title: 'Capítulo 1',
        blocks: [
          { type: 'paragraph', runs: [{ text: 'Um parágrafo de teste.' }] },
        ],
      },
    ],
  };
}

function minimalMetadados(): EpubMetadados {
  return {
    titulo: 'Livro de Teste',
    autor: 'Autor Teste',
    isbn: null,
    idioma: 'pt-BR',
    capaUrl: null,
  };
}

function defaultLayout(): EpubLayout {
  return {
    fonteCorpoFamilia: 'serif',
    fonteCorpoTamanho: 12,
    espacamentoLinha: 1.5,
    margemLateral: 20,
    h1Tamanho: 24,
    h2Tamanho: 20,
    h3Tamanho: 16,
  };
}

/** Parses the ZIP central directory to extract filenames. */
function listZipEntries(buf: Buffer): string[] {
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = buf.length - 22;
  while (eocdOffset >= 0 && buf.readUInt32LE(eocdOffset) !== EOCD_SIG) {
    eocdOffset--;
  }
  if (eocdOffset < 0) throw new Error('Invalid ZIP: EOCD not found');

  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);
  const entryCount = buf.readUInt16LE(eocdOffset + 8);
  const names: string[] = [];
  let pos = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x02014b50) throw new Error(`Invalid CDH signature at ${pos}`);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    names.push(buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf-8'));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

/** Reads the first entry's local header to verify it is STORED. */
function firstEntryIsStored(buf: Buffer): boolean {
  // Local file header starts at byte 0
  const sig = buf.readUInt32LE(0);
  if (sig !== 0x04034b50) return false;
  const method = buf.readUInt16LE(8);
  return method === 0; // 0 = STORED
}

/** Reads the mimetype content from the first local entry. */
function readFirstEntryContent(buf: Buffer): string {
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataOffset = 30 + nameLen + extraLen;
  const compSize = buf.readUInt32LE(18);
  return buf.subarray(dataOffset, dataOffset + compSize).toString('utf-8');
}

function findEntryContent(buf: Buffer, targetName: string): Buffer | null {
  const LOCAL_SIG = 0x04034b50;
  let pos = 0;
  while (pos < buf.length - 30) {
    if (buf.readUInt32LE(pos) !== LOCAL_SIG) break;
    const method = buf.readUInt16LE(pos + 8);
    const compSize = buf.readUInt32LE(pos + 18);
    const nameLen = buf.readUInt16LE(pos + 26);
    const extraLen = buf.readUInt16LE(pos + 28);
    const name = buf.subarray(pos + 30, pos + 30 + nameLen).toString('utf-8');
    const dataStart = pos + 30 + nameLen + extraLen;
    if (name === targetName) {
      if (method === 0) return buf.subarray(dataStart, dataStart + compSize);
      // DEFLATE: decompress
      return inflateRawSync(buf.subarray(dataStart, dataStart + compSize));
    }
    pos = dataStart + compSize;
  }
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EpubBuilder', () => {
  let builder: EpubBuilder;

  beforeEach(() => {
    builder = new EpubBuilder();
  });

  describe('OCF ZIP structure', () => {
    it('produces a non-empty Buffer for minimal input (1 chapter, 1 paragraph)', async () => {
      const { epubBytes: buf } = await builder.build(minimalTree(), minimalMetadados(), null);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('first entry is "mimetype" and is STORED (OCF §3.3)', async () => {
      const { epubBytes: buf } = await builder.build(minimalTree(), minimalMetadados(), null);
      expect(firstEntryIsStored(buf)).toBe(true);
      const content = readFirstEntryContent(buf);
      expect(content).toBe('application/epub+zip');
    });

    it('ZIP contains required ePub 3 entries', async () => {
      const { epubBytes: buf } = await builder.build(minimalTree(), minimalMetadados(), null);
      const entries = listZipEntries(buf);
      expect(entries).toContain('mimetype');
      expect(entries).toContain('META-INF/container.xml');
      expect(entries).toContain('OEBPS/content.opf');
      expect(entries).toContain('OEBPS/nav.xhtml');
      expect(entries).toContain('OEBPS/css/style.css');
      expect(entries).toContain('OEBPS/chapter-1.xhtml');
    });
  });

  describe('OPF metadata', () => {
    it('OPF contains titulo, autor, and idioma', async () => {
      const { epubBytes: buf } = await builder.build(minimalTree(), minimalMetadados(), null);
      const opfBytes = findEntryContent(buf, 'OEBPS/content.opf');
      expect(opfBytes).not.toBeNull();
      const opfXml = opfBytes!.toString('utf-8');
      expect(opfXml).toContain('Livro de Teste');
      expect(opfXml).toContain('Autor Teste');
      expect(opfXml).toContain('pt-BR');
    });

    it('OPF uses isbn URN when isbn is provided', async () => {
      const meta = { ...minimalMetadados(), isbn: '978-85-000-0000-0' };
      const { epubBytes: buf } = await builder.build(minimalTree(), meta, null);
      const opfBytes = findEntryContent(buf, 'OEBPS/content.opf');
      const opfXml = opfBytes!.toString('utf-8');
      expect(opfXml).toContain('urn:isbn:');
    });

    it('OPF falls back to deterministic urn:uuid when isbn is null', async () => {
      const { epubBytes: buf } = await builder.build(minimalTree(), minimalMetadados(), null);
      const opfBytes = findEntryContent(buf, 'OEBPS/content.opf');
      expect(opfBytes!.toString('utf-8')).toContain('urn:uuid:cordele-');
    });
  });

  describe('Content rendering', () => {
    it('chapter XHTML includes the chapter title and paragraph text', async () => {
      const { epubBytes: buf } = await builder.build(minimalTree(), minimalMetadados(), null);
      const xhtmlBytes = findEntryContent(buf, 'OEBPS/chapter-1.xhtml');
      expect(xhtmlBytes).not.toBeNull();
      const xhtml = xhtmlBytes!.toString('utf-8');
      expect(xhtml).toContain('Capítulo 1');
      expect(xhtml).toContain('Um parágrafo de teste.');
    });

    it('unparsed blocks are included in chapter XHTML (D-H: never discarded)', async () => {
      const treeWithUnparsed: EpubContentTree = {
        manuscritoId: 'ms-1',
        estrutura: [
          {
            type: 'chapter',
            title: 'Cap 1',
            blocks: [
              { type: 'unparsed', rawHtml: '<b>Unparsed content</b>' },
            ],
          },
        ],
      };
      const { epubBytes: buf } = await builder.build(treeWithUnparsed, minimalMetadados(), null);
      const xhtmlBytes = findEntryContent(buf, 'OEBPS/chapter-1.xhtml');
      const xhtml = xhtmlBytes!.toString('utf-8');
      expect(xhtml).toContain('unparsed');
      expect(xhtml).toContain('Unparsed content');
    });

    it('image block is referenced in XHTML when imageLoader returns bytes', async () => {
      const imageContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
      const treeWithImage: EpubContentTree = {
        manuscritoId: 'ms-1',
        estrutura: [
          {
            type: 'chapter',
            title: 'Cap 1',
            blocks: [
              { type: 'paragraph', runs: [{ text: 'Texto.' }] },
              { type: 'image', storageKey: 'covers/cover.png', alt: 'Capa' },
            ],
          },
        ],
      };
      const loadImage = jest.fn().mockResolvedValue(imageContent);
      const { epubBytes: buf } = await builder.build(treeWithImage, minimalMetadados(), null, loadImage);
      const entries = listZipEntries(buf);
      // Image is embedded in the OCF package
      expect(entries.some((e) => e.includes('covers_cover.png') || e.includes('cover'))).toBe(true);
      expect(loadImage).toHaveBeenCalledWith('covers/cover.png');
    });

    it('build proceeds when imageLoader returns null (image omitted from OCF)', async () => {
      const treeWithImage: EpubContentTree = {
        manuscritoId: 'ms-1',
        estrutura: [
          {
            type: 'chapter',
            title: 'Cap 1',
            blocks: [{ type: 'image', storageKey: 'missing.jpg', alt: '' }],
          },
        ],
      };
      const loadImage = jest.fn().mockResolvedValue(null);
      const { epubBytes: buf } = await builder.build(treeWithImage, minimalMetadados(), null, loadImage);
      expect(buf.length).toBeGreaterThan(0);
    });
  });

  describe('Layout', () => {
    it('CSS uses provided layout parameters', async () => {
      const layout: EpubLayout = {
        ...defaultLayout(),
        fonteCorpoFamilia: 'sans-serif',
        h1Tamanho: 30,
      };
      const { epubBytes: buf } = await builder.build(minimalTree(), minimalMetadados(), layout);
      const cssBytes = findEntryContent(buf, 'OEBPS/css/style.css');
      const css = cssBytes!.toString('utf-8');
      expect(css).toContain('sans-serif');
      expect(css).toContain('30pt');
    });

    it('CSS uses documented defaults when layout is null', async () => {
      const { epubBytes: buf } = await builder.build(minimalTree(), minimalMetadados(), null);
      const cssBytes = findEntryContent(buf, 'OEBPS/css/style.css');
      const css = cssBytes!.toString('utf-8');
      // Default: fonteCorpoFamilia=serif, h1=24pt
      expect(css).toContain('serif');
      expect(css).toContain('24pt');
    });
  });

  describe('Determinism', () => {
    it('same input produces identical Buffer (bit-for-bit)', async () => {
      const tree = minimalTree();
      const meta = minimalMetadados();
      const layout = defaultLayout();
      const { epubBytes: buf1 } = await builder.build(tree, meta, layout);
      const { epubBytes: buf2 } = await builder.build(tree, meta, layout);
      expect(buf1.equals(buf2)).toBe(true);
    });
  });

  describe('ADR-004: KPIs de resumo (totalCapitulos, totalImagens)', () => {
    it('retorna totalCapitulos igual ao número de capítulos no manuscrito', async () => {
      const treeWith2Chapters: EpubContentTree = {
        manuscritoId: 'ms-1',
        estrutura: [
          { type: 'chapter', title: 'Cap 1', blocks: [{ type: 'paragraph', runs: [{ text: 'Texto 1.' }] }] },
          { type: 'chapter', title: 'Cap 2', blocks: [{ type: 'paragraph', runs: [{ text: 'Texto 2.' }] }] },
        ],
      };
      const { totalCapitulos } = await builder.build(treeWith2Chapters, minimalMetadados(), null);
      expect(totalCapitulos).toBe(2);
    });

    it('retorna totalCapitulos=0 para manuscrito sem capítulos (fallback inserido pelo builder)', async () => {
      const emptyTree: EpubContentTree = { manuscritoId: 'ms-empty', estrutura: [] };
      const { totalCapitulos } = await builder.build(emptyTree, minimalMetadados(), null);
      expect(totalCapitulos).toBe(0);
    });

    it('retorna totalImagens igual ao número de imagens distintas referenciadas', async () => {
      const treeWithImages: EpubContentTree = {
        manuscritoId: 'ms-1',
        estrutura: [
          {
            type: 'chapter',
            title: 'Cap 1',
            blocks: [
              { type: 'image', storageKey: 'img/a.png', alt: 'A' },
              { type: 'image', storageKey: 'img/b.png', alt: 'B' },
            ],
          },
        ],
      };
      const loadImage = jest.fn().mockResolvedValue(null);
      const { totalImagens } = await builder.build(treeWithImages, minimalMetadados(), null, loadImage);
      expect(totalImagens).toBe(2);
    });

    it('retorna totalImagens=0 para manuscrito sem imagens', async () => {
      const { totalImagens } = await builder.build(minimalTree(), minimalMetadados(), null);
      expect(totalImagens).toBe(0);
    });

    it('retorna epubBytes como Buffer não vazio', async () => {
      const { epubBytes } = await builder.build(minimalTree(), minimalMetadados(), null);
      expect(epubBytes).toBeInstanceOf(Buffer);
      expect(epubBytes.length).toBeGreaterThan(0);
    });
  });
});
