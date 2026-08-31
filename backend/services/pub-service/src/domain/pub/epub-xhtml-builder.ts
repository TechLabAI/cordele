/**
 * Serializes content-tree block nodes into XHTML 1.1 documents suitable
 * for inclusion in an ePub 3 OCF package (SPEC-03 §2).
 *
 * Domain-pure: no @nestjs/* or @prisma/* imports.
 *
 * Supported block types (aligned with IMP api-contract §6.2):
 *   - paragraph  → <p> with inline run/mark spans
 *   - heading    → <h1>/<h2>/<h3>
 *   - image      → <img> with relative OEBPS path; alignment applied via CSS class
 *   - unparsed   → <div class="unparsed"> preserving raw content (D-H: never discarded)
 */

/** Text run mark types surfaced by IMP (api-contract §6.2). */
export type RunMark = 'bold' | 'italic' | 'underline';

export interface RunNode {
  readonly text: string;
  readonly marks?: RunMark[];
}

export interface ParagraphBlock {
  readonly type: 'paragraph';
  readonly runs: RunNode[];
}

export interface HeadingBlock {
  readonly type: 'heading';
  readonly level: 1 | 2 | 3;
  readonly text: string;
}

export interface ImageBlock {
  readonly type: 'image';
  readonly storageKey: string;
  readonly alt?: string;
  /** Image alignment override from COMP layout (null = default block). */
  readonly alignment?: 'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita' | null;
}

export interface UnparsedBlock {
  readonly type: 'unparsed';
  /** Raw HTML or plain text preserved without transformation. */
  readonly rawHtml: string;
}

export type ContentBlock = ParagraphBlock | HeadingBlock | ImageBlock | UnparsedBlock;

/** A chapter node is the top-level structural unit in the content tree. */
export interface ChapterNode {
  readonly type: 'chapter';
  readonly title: string;
  readonly blocks: ContentBlock[];
}

/** Minimal XML escaping for text content. */
function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Serializes a single run to inline XHTML, applying marks as nested spans. */
function serializeRun(run: RunNode): string {
  const escaped = xmlEscape(run.text);
  if (!run.marks || run.marks.length === 0) return escaped;

  let content = escaped;
  for (const mark of run.marks) {
    if (mark === 'bold') content = `<strong>${content}</strong>`;
    else if (mark === 'italic') content = `<em>${content}</em>`;
    else if (mark === 'underline') content = `<span style="text-decoration:underline">${content}</span>`;
  }
  return content;
}

/** Serializes a content block to XHTML. */
function serializeBlock(block: ContentBlock): string {
  switch (block.type) {
    case 'paragraph': {
      const inner = block.runs.map(serializeRun).join('');
      return `<p>${inner}</p>`;
    }
    case 'heading': {
      const tag = `h${block.level}`;
      return `<${tag}>${xmlEscape(block.text)}</${tag}>`;
    }
    case 'image': {
      // storageKey maps to relative OEBPS image path via imageId computed in EpubBuilder
      const key = block.storageKey.replace(/[^a-zA-Z0-9._-]/g, '_');
      const imgPath = `images/${key}`;
      const alt = xmlEscape(block.alt ?? '');
      const cssClass = block.alignment ? ` class="align-${block.alignment}"` : '';
      return `<img src="${imgPath}" alt="${alt}"${cssClass}/>`;
    }
    case 'unparsed': {
      // Preserve raw content in a dedicated div (D-H: unparsed blocks never discarded)
      return `<div class="unparsed">${block.rawHtml}</div>`;
    }
  }
}

/** XHTML 1.1 document wrapper (required for ePub 3 content documents). */
const XHTML_DOCTYPE = '<?xml version="1.0" encoding="UTF-8"?>';

const XHTML_NS_ATTRS =
  'xmlns="http://www.w3.org/1999/xhtml" ' +
  'xmlns:epub="http://www.idpf.org/2007/ops" ' +
  'xml:lang="{lang}"';

/**
 * Builds a complete XHTML content document for a single chapter.
 *
 * @param chapter  The chapter node from the content tree.
 * @param cssPath  Relative path from this document to the CSS file (e.g. `css/style.css`).
 * @param idioma   BCP-47 language tag for the `xml:lang` attribute.
 * @returns        UTF-8 XHTML string ready for inclusion in the OCF package.
 */
export function buildChapterXhtml(chapter: ChapterNode, cssPath: string, idioma: string): string {
  const ns = XHTML_NS_ATTRS.replace('{lang}', xmlEscape(idioma));
  const blocks = chapter.blocks.map(serializeBlock).join('\n  ');

  return (
    `${XHTML_DOCTYPE}\n` +
    `<html ${ns}>\n` +
    `<head>\n` +
    `  <meta charset="UTF-8"/>\n` +
    `  <title>${xmlEscape(chapter.title)}</title>\n` +
    `  <link rel="stylesheet" type="text/css" href="${cssPath}"/>\n` +
    `</head>\n` +
    `<body>\n` +
    `  <section epub:type="chapter">\n` +
    `    <h1>${xmlEscape(chapter.title)}</h1>\n` +
    `    ${blocks}\n` +
    `  </section>\n` +
    `</body>\n` +
    `</html>`
  );
}

/**
 * Builds the ePub 3 nav document (navigation document required by spec).
 * Uses epub:type="toc" as required by ePub 3 (SPEC-03 §2).
 */
export function buildNavXhtml(
  bookTitle: string,
  chapters: Array<{ id: string; title: string; href: string }>,
  idioma: string,
): string {
  const ns = XHTML_NS_ATTRS.replace('{lang}', xmlEscape(idioma));
  const tocItems = chapters
    .map((c) => `      <li><a href="${c.href}">${xmlEscape(c.title)}</a></li>`)
    .join('\n');

  return (
    `${XHTML_DOCTYPE}\n` +
    `<html ${ns}>\n` +
    `<head>\n` +
    `  <meta charset="UTF-8"/>\n` +
    `  <title>${xmlEscape(bookTitle)}</title>\n` +
    `</head>\n` +
    `<body>\n` +
    `  <nav epub:type="toc" id="toc">\n` +
    `    <h1>Sumário</h1>\n` +
    `    <ol>\n` +
    `${tocItems}\n` +
    `    </ol>\n` +
    `  </nav>\n` +
    `</body>\n` +
    `</html>`
  );
}
