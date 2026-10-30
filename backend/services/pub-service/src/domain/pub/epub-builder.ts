import { deflateRawSync } from 'node:zlib';

import { buildEpubCss, type EpubLayoutForCss } from './epub-css-builder';
import { buildOpf, type ManifestItem, type SpineItem } from './epub-opf-builder';
import { buildChapterXhtml, buildNavXhtml, type ChapterNode, type ContentBlock, type ImageBlock } from './epub-xhtml-builder';

/**
 * EpubBuilder — domain service (PUB-009, P4).
 *
 * Converts a content tree (from IMP), editorial metadata (from COMP) and a
 * layout configuration (from COMP, optional) into a well-formed OCF/ePub 3
 * Buffer ready for validation by EpubcheckValidationAdapter.
 *
 * Domain-pure: no @nestjs/* or @prisma/* imports. Uses only Node.js built-in
 * `node:zlib` for DEFLATE compression; ZIP format written with plain Buffers.
 *
 * ### OCF §3.3 compliance
 * - `mimetype` is always the FIRST entry in the ZIP and is NOT compressed (STORED).
 * - All other entries use DEFLATE (level 6).
 * - Deterministic: file order is fixed; all timestamps are 1980-01-01 00:00:00
 *   (no volatile metadata); image content comes from the caller's imageLoader,
 *   not from the file system directly.
 *
 * ### Unparsed segments (D-H)
 * `unparsed` blocks are preserved in the XHTML via `<div class="unparsed">`;
 * they are never silently discarded.
 *
 * ### Missing data defaults (SPEC-03 §2, COMP §7.2)
 * - `layout = null` → CSS uses documented defaults from `epub-css-builder.ts`.
 * - Missing images (imageLoader returns null) → `<img>` tag kept, src points
 *   to the expected path even if the image is absent from the ZIP (build proceeds).
 */

// ─── Locally-scoped input types ─────────────────────────────────────────────
// Defined here (not imported from modules/) so domain/ has zero modules/ deps.
// Structurally compatible with modules/pub/ports/* — TypeScript structural
// typing ensures the call site in modules/ passes without casting.

/** Minimal manuscript tree shape consumed by EpubBuilder. */
export interface EpubContentTree {
  readonly manuscritoId: string;
  readonly estrutura: readonly unknown[];
}

/** Minimal editorial metadata consumed by EpubBuilder. */
export interface EpubMetadados {
  readonly titulo: string | null;
  readonly autor: string | null;
  readonly isbn: string | null;
  readonly idioma: string | null;
  readonly capaUrl: string | null;
}

/** Minimal layout config consumed by EpubBuilder (nullable → defaults applied). */
export type EpubLayout = EpubLayoutForCss;

/**
 * Async function that resolves a storage key to image bytes.
 * Returns `null` when the image is unavailable — the build continues (the
 * <img> element is still included; the image simply won't be in the OCF package).
 */
export type EpubImageLoader = (storageKey: string) => Promise<Buffer | null>;

// ─── OCF ZIP writer ──────────────────────────────────────────────────────────

/** Computes CRC-32 using the standard polynomial 0xEDB88320. */
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]!;
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * DOS timestamp for 1980-01-01 00:00:00 — used for all entries so the
 * resulting ZIP is deterministic across builds (same input → same bytes).
 */
const DOS_TIME = 0;                       // 00:00:00
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // year=1980, month=1, day=1

interface ZipEntry {
  name: string;
  content: Buffer;
  /** If false, entry is STORED (no compression). Default: true → DEFLATE. */
  compress?: boolean;
}

/**
 * Builds a ZIP archive buffer from the given entries.
 *
 * The first entry MUST be `mimetype` and will be forced to STORED regardless
 * of the `compress` flag (OCF §3.3).
 */
function buildOcfZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const nameBytes = Buffer.from(entry.name, 'utf-8');
    // OCF §3.3: first entry (mimetype) MUST be STORED
    const shouldCompress = i > 0 && (entry.compress !== false);
    const method = shouldCompress ? 8 : 0; // 8 = DEFLATE, 0 = STORED
    const compressedData = shouldCompress
      ? deflateRawSync(entry.content, { level: 6 })
      : entry.content;
    const rawCrc = crc32(entry.content);

    // Local file header (30 bytes fixed + filename)
    const lfh = Buffer.alloc(30 + nameBytes.length);
    lfh.writeUInt32LE(0x04034b50, 0);           // PK\x03\x04
    lfh.writeUInt16LE(20, 4);                    // version needed: 2.0
    lfh.writeUInt16LE(0x0800, 6);               // flags: UTF-8 filename
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(DOS_TIME, 10);
    lfh.writeUInt16LE(DOS_DATE, 12);
    lfh.writeUInt32LE(rawCrc, 14);
    lfh.writeUInt32LE(compressedData.length, 18);
    lfh.writeUInt32LE(entry.content.length, 22);
    lfh.writeUInt16LE(nameBytes.length, 26);
    lfh.writeUInt16LE(0, 28);                    // extra field length: 0
    nameBytes.copy(lfh, 30);

    localParts.push(lfh, compressedData);

    // Central directory header (46 bytes fixed + filename)
    const cdh = Buffer.alloc(46 + nameBytes.length);
    cdh.writeUInt32LE(0x02014b50, 0);           // PK\x01\x02
    cdh.writeUInt16LE(20, 4);                    // version made by
    cdh.writeUInt16LE(20, 6);                    // version needed
    cdh.writeUInt16LE(0x0800, 8);               // flags
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(DOS_TIME, 12);
    cdh.writeUInt16LE(DOS_DATE, 14);
    cdh.writeUInt32LE(rawCrc, 16);
    cdh.writeUInt32LE(compressedData.length, 20);
    cdh.writeUInt32LE(entry.content.length, 24);
    cdh.writeUInt16LE(nameBytes.length, 28);
    cdh.writeUInt16LE(0, 30);                    // extra field length
    cdh.writeUInt16LE(0, 32);                    // file comment length
    cdh.writeUInt16LE(0, 34);                    // disk number start
    cdh.writeUInt16LE(0, 36);                    // internal attributes
    cdh.writeUInt32LE(0, 38);                    // external attributes
    cdh.writeUInt32LE(localOffset, 42);          // relative offset of local header
    nameBytes.copy(cdh, 46);

    centralParts.push(cdh);
    localOffset += 30 + nameBytes.length + compressedData.length;
  }

  const centralDir = Buffer.concat(centralParts);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);             // PK\x05\x06
  eocd.writeUInt16LE(0, 4);                       // disk number
  eocd.writeUInt16LE(0, 6);                       // disk with start of central dir
  eocd.writeUInt16LE(entries.length, 8);          // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);         // total entries
  eocd.writeUInt32LE(centralDir.length, 12);      // central dir size
  eocd.writeUInt32LE(localOffset, 16);            // central dir offset
  eocd.writeUInt16LE(0, 20);                      // comment length

  return Buffer.concat([...localParts, centralDir, eocd]);
}

// ─── Content-tree parsing helpers ────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Coerces an unknown node to ChapterNode if it matches the shape. */
function toChapterNode(node: unknown): ChapterNode | null {
  if (!isObject(node) || node['type'] !== 'chapter') return null;
  const blocks = Array.isArray(node['blocks']) ? (node['blocks'] as unknown[]) : [];
  return {
    type: 'chapter',
    title: typeof node['title'] === 'string' ? node['title'] : 'Capítulo',
    blocks: blocks.filter(isObject) as unknown as ContentBlock[],
  };
}

/** Recursively collects all ImageBlock nodes in a chapter's blocks. */
function collectImages(blocks: ContentBlock[]): ImageBlock[] {
  return blocks.filter((b): b is ImageBlock => b.type === 'image');
}

// ─── Main EpubBuilder class ───────────────────────────────────────────────────

/**
 * Assembles an OCF/ePub 3 Buffer from content tree + metadata + layout.
 *
 * Instantiate directly (no DI tokens required): the build job creates one
 * instance per build, passing its own fileStoragePort.get() as the image loader.
 */
export class EpubBuilder {
  /**
   * Assembles the complete ePub 3 package.
   *
   * ADR-004: retorna um objeto com `epubBytes`, `totalCapitulos` e `totalImagens`
   * em vez de apenas o Buffer, para que o `PublicationBuildJob` possa persistir
   * os KPIs de resumo sem re-inspecionar o arquivo gerado.
   *
   * @param tree       Manuscript content tree (from ManuscriptContentPort).
   * @param metadados  Editorial metadata (from CompositionMetadataPort).
   * @param layout     Layout configuration (from CompositionLayoutPort), or null for defaults.
   * @param loadImage  Optional async loader for image bytes by storage key.
   *                   When absent or returning null, the image is omitted from OCF.
   * @returns          `{ epubBytes, totalCapitulos, totalImagens }`
   */
  async build(
    tree: EpubContentTree,
    metadados: EpubMetadados,
    layout: EpubLayout | null,
    loadImage?: EpubImageLoader,
  ): Promise<{ epubBytes: Buffer; totalCapitulos: number; totalImagens: number }> {
    const titulo = metadados.titulo ?? 'Sem título';
    const autor = metadados.autor ?? 'Autor desconhecido';
    const idioma = metadados.idioma ?? 'pt-BR';

    // Parse the content tree into typed ChapterNodes
    const chapters: ChapterNode[] = (tree.estrutura as unknown[])
      .map(toChapterNode)
      .filter((c): c is ChapterNode => c !== null);

    // ADR-004: contar capítulos do manuscrito original (antes de inserir o fallback)
    const totalCapitulosContados = chapters.length;

    // Ensure at least one chapter exists (ePub must have content)
    if (chapters.length === 0) {
      chapters.push({
        type: 'chapter',
        title: titulo,
        blocks: [{ type: 'paragraph', runs: [{ text: 'Sem conteúdo.' }] }],
      });
    }

    const manifestItems: ManifestItem[] = [];
    const spineItems: SpineItem[] = [];
    const zipEntries: ZipEntry[] = [];

    // ── Build CSS ──────────────────────────────────────────────────────────
    const cssContent = buildEpubCss(layout);
    zipEntries.push({
      name: 'OEBPS/css/style.css',
      content: Buffer.from(cssContent, 'utf-8'),
    });
    manifestItems.push({ id: 'css-style', href: 'css/style.css', mediaType: 'text/css' });

    // ── Load images ────────────────────────────────────────────────────────
    // Collect all image storage keys referenced in all chapters (ADR-004: totalImagens)
    const imageKeys = new Set<string>();
    for (const chapter of chapters) {
      for (const img of collectImages(chapter.blocks)) {
        imageKeys.add(img.storageKey);
      }
    }
    // ADR-004: totalImagens = number of distinct image references in the manuscript
    const totalImagensContadas = imageKeys.size;

    for (const key of imageKeys) {
      const imageBytes = loadImage ? await loadImage(key) : null;
      if (imageBytes) {
        const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
        const mediaType = safeKey.match(/\.(jpe?g)$/i) ? 'image/jpeg' : 'image/png';
        zipEntries.push({ name: `OEBPS/images/${safeKey}`, content: imageBytes });
        manifestItems.push({
          id: `img-${safeKey.replace(/\./g, '-')}`,
          href: `images/${safeKey}`,
          mediaType,
        });
      }
    }

    // ── Build chapter XHTML documents ─────────────────────────────────────
    const chapterRefs: Array<{ id: string; title: string; href: string }> = [];
    for (let idx = 0; idx < chapters.length; idx++) {
      const chapter = chapters[idx]!;
      const chapterId = `chapter-${idx + 1}`;
      const chapterHref = `${chapterId}.xhtml`;
      const xhtml = buildChapterXhtml(chapter, 'css/style.css', idioma);

      zipEntries.push({ name: `OEBPS/${chapterHref}`, content: Buffer.from(xhtml, 'utf-8') });
      manifestItems.push({ id: chapterId, href: chapterHref, mediaType: 'application/xhtml+xml' });
      spineItems.push({ idref: chapterId });
      chapterRefs.push({ id: chapterId, title: chapter.title, href: chapterHref });
    }

    // ── Build nav.xhtml ────────────────────────────────────────────────────
    const navXhtml = buildNavXhtml(titulo, chapterRefs, idioma);
    zipEntries.push({ name: 'OEBPS/nav.xhtml', content: Buffer.from(navXhtml, 'utf-8') });
    manifestItems.push({
      id: 'nav',
      href: 'nav.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: 'nav',
    });

    // ── Build OPF ──────────────────────────────────────────────────────────
    const opfXml = buildOpf({
      metadados: { titulo, autor, isbn: metadados.isbn, idioma, capaUrl: metadados.capaUrl },
      manifestItems,
      spineItems,
    });
    zipEntries.push({ name: 'OEBPS/content.opf', content: Buffer.from(opfXml, 'utf-8') });

    // ── Build META-INF/container.xml ───────────────────────────────────────
    const containerXml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n` +
      `  <rootfiles>\n` +
      `    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n` +
      `  </rootfiles>\n` +
      `</container>`;
    zipEntries.push({
      name: 'META-INF/container.xml',
      content: Buffer.from(containerXml, 'utf-8'),
    });

    // ── Assemble the OCF ZIP ───────────────────────────────────────────────
    // OCF §3.3: `mimetype` MUST be the first entry, STORED.
    const allEntries: ZipEntry[] = [
      { name: 'mimetype', content: Buffer.from('application/epub+zip', 'utf-8'), compress: false },
      ...zipEntries,
    ];

    const epubBytes = buildOcfZip(allEntries);

    // ADR-004: retornar KPIs de resumo junto com o buffer do ePub
    return {
      epubBytes,
      totalCapitulos: totalCapitulosContados,
      totalImagens: totalImagensContadas,
    };
  }
}
