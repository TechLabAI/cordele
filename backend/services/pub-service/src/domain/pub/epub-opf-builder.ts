/**
 * Generates the OPF Package Document (SPEC-03 §2, ePub 3 spec §2.4).
 *
 * Produces: <package> with <metadata>, <manifest>, and <spine>.
 * All items use stable IDs derived from their path — no volatile timestamps
 * or random values (determinism requirement, epub-builder.spec §criteria).
 *
 * Domain-pure: no @nestjs/* or @prisma/* imports.
 */

/** Minimal XML escaping for attribute values and text content. */
function xmlEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface OpfMetadados {
  readonly titulo: string;
  readonly autor: string;
  readonly idioma: string;
  readonly isbn: string | null;
  readonly capaUrl: string | null;
}

export interface ManifestItem {
  readonly id: string;
  readonly href: string;
  readonly mediaType: string;
  /** Set to 'nav' for the navigation document (epub:type). */
  readonly properties?: string;
}

export interface SpineItem {
  /** Must match a ManifestItem.id. */
  readonly idref: string;
  readonly linear?: boolean;
}

export interface OpfInput {
  readonly metadados: OpfMetadados;
  readonly manifestItems: ManifestItem[];
  readonly spineItems: SpineItem[];
  /** Id of the manifest item that serves as the cover image. */
  readonly coverImageId?: string;
}

/**
 * Derives a stable identifier from the manuscript metadata.
 * Falls back to a deterministic UUID-like string when isbn is absent.
 */
function deriveIdentifier(metadados: OpfMetadados): string {
  if (metadados.isbn) {
    const cleaned = metadados.isbn.replace(/[^0-9X]/gi, '');
    return `urn:isbn:${cleaned}`;
  }
  // Deterministic fallback: hash of titulo + autor
  const seed = `${metadados.titulo}::${metadados.autor}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) >>> 0;
  }
  return `urn:uuid:cordele-${h.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`;
}

/**
 * Builds the OPF Package Document XML string.
 *
 * @param input - Manifest, spine, and Dublin Core metadata.
 * @returns     UTF-8 XML string for `OEBPS/content.opf`.
 */
export function buildOpf(input: OpfInput): string {
  const { metadados, manifestItems, spineItems, coverImageId } = input;
  const uid = deriveIdentifier(metadados);

  const coverMeta = coverImageId
    ? `  <meta name="cover" content="${xmlEsc(coverImageId)}"/>\n`
    : '';

  const manifestLines = manifestItems
    .map((item) => {
      const props = item.properties ? ` properties="${xmlEsc(item.properties)}"` : '';
      return `    <item id="${xmlEsc(item.id)}" href="${xmlEsc(item.href)}" media-type="${xmlEsc(item.mediaType)}"${props}/>`;
    })
    .join('\n');

  const spineLines = spineItems
    .map((item) => {
      const linear = item.linear === false ? ' linear="no"' : '';
      return `    <itemref idref="${xmlEsc(item.idref)}"${linear}/>`;
    })
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">\n` +
    `  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
    `    <dc:identifier id="book-id">${xmlEsc(uid)}</dc:identifier>\n` +
    `    <dc:title>${xmlEsc(metadados.titulo)}</dc:title>\n` +
    `    <dc:creator>${xmlEsc(metadados.autor)}</dc:creator>\n` +
    `    <dc:language>${xmlEsc(metadados.idioma)}</dc:language>\n` +
    coverMeta +
    `    <meta property="dcterms:modified">1980-01-01T00:00:00Z</meta>\n` +
    `  </metadata>\n` +
    `  <manifest>\n` +
    manifestLines + '\n' +
    `  </manifest>\n` +
    `  <spine>\n` +
    spineLines + '\n' +
    `  </spine>\n` +
    `</package>`
  );
}
