import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';

import { DiskFileStorageAdapter } from './disk-file-storage.adapter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAdapter(storageRoot: string, signSecret = 'test-secret') {
  const configGet = jest.fn().mockImplementation((key: string) => {
    if (key === 'PUB_STORAGE_ROOT') return storageRoot;
    if (key === 'PUB_SIGN_SECRET') return signSecret;
    if (key === 'PUB_DOWNLOAD_URL_TTL_SECONDS') return 900;
    return undefined;
  });
  return new DiskFileStorageAdapter({ get: configGet } as unknown as ConfigService);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DiskFileStorageAdapter', () => {
  // Use a unique temp directory per test run so tests are isolated
  const storageRoot = join(tmpdir(), `pub-storage-test-${randomUUID()}`);

  describe('put', () => {
    it('creates the file at the correct path under storageRoot', async () => {
      const adapter = buildAdapter(storageRoot);
      const key = `emp_aetos/publicacoes/${randomUUID()}/output.epub`;
      const content = Buffer.from('epub-content');
      await adapter.put(key, content, 'application/epub+zip');

      const { readFile } = await import('node:fs/promises');
      const written = await readFile(join(storageRoot, key));
      expect(written).toEqual(content);
    });

    it('returns a URL containing the key', async () => {
      const adapter = buildAdapter(storageRoot);
      const key = `emp_aetos/publicacoes/${randomUUID()}/output.epub`;
      const result = await adapter.put(key, Buffer.from('x'), 'application/epub+zip');
      expect(result.url).toContain(encodeURIComponent(key));
    });

    it('ADR-004: retorna bytesWritten igual ao tamanho do Buffer escrito', async () => {
      const adapter = buildAdapter(storageRoot);
      const key = `emp_aetos/publicacoes/${randomUUID()}/output.epub`;
      const content = Buffer.from('epub-content-com-tamanho-conhecido');
      const result = await adapter.put(key, content, 'application/epub+zip');
      expect(result.bytesWritten).toBe(content.byteLength);
    });

    it('ADR-004: retorna bytesWritten para Readable stream', async () => {
      const { Readable } = await import('node:stream');
      const adapter = buildAdapter(storageRoot);
      const key = `emp_aetos/publicacoes/${randomUUID()}/output.epub`;
      const data = Buffer.from('stream-content');
      const stream = Readable.from(data);
      const result = await adapter.put(key, stream, 'application/epub+zip');
      expect(result.bytesWritten).toBe(data.byteLength);
    });
  });

  describe('delete', () => {
    it('removes an existing file', async () => {
      const adapter = buildAdapter(storageRoot);
      const key = `emp_aetos/publicacoes/${randomUUID()}/output.epub`;
      await adapter.put(key, Buffer.from('x'), 'application/epub+zip');
      await adapter.delete(key);

      const { access } = await import('node:fs/promises');
      await expect(access(join(storageRoot, key))).rejects.toThrow();
    });

    it('does NOT throw for a key that does not exist (idempotent — D-Q purge path)', async () => {
      const adapter = buildAdapter(storageRoot);
      const missingKey = `emp_aetos/publicacoes/${randomUUID()}/nonexistent.epub`;
      await expect(adapter.delete(missingKey)).resolves.not.toThrow();
    });
  });

  describe('signUrl', () => {
    it('returns a URL with expiresAt in the future', async () => {
      const adapter = buildAdapter(storageRoot);
      const before = Date.now();
      const { url, expiresAt } = await adapter.signUrl('emp_aetos/pub/x.epub', 300);
      const expiresMs = new Date(expiresAt).getTime();
      expect(expiresMs).toBeGreaterThan(before + 299_000);
      expect(url).toContain('token=');
      expect(url).toContain('expires=');
    });

    it('uses the provided ttlSeconds for expiry calculation', async () => {
      const adapter = buildAdapter(storageRoot);
      const before = Date.now();
      const { expiresAt } = await adapter.signUrl('emp_aetos/pub/x.epub', 60);
      const diff = new Date(expiresAt).getTime() - before;
      // Should be approximately 60s (allow 2s margin for slow test environments)
      expect(diff).toBeGreaterThan(58_000);
      expect(diff).toBeLessThan(62_000);
    });

    it('different keys produce different tokens (token is key-scoped)', async () => {
      const adapter = buildAdapter(storageRoot, 'stable-secret');
      const { url: url1 } = await adapter.signUrl('key-a', 300);
      const { url: url2 } = await adapter.signUrl('key-b', 300);
      const token1 = new URLSearchParams(url1.split('?')[1]).get('token');
      const token2 = new URLSearchParams(url2.split('?')[1]).get('token');
      expect(token1).not.toBe(token2);
    });
  });
});
