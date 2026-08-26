import { ConfigService } from '@nestjs/config';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { ValidationSeverity } from '../../../domain/pub/validation-severity.enum';
import { EpubcheckValidationAdapter } from './epubcheck-validation.adapter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAdapter(jarPath: string | undefined) {
  const configGet = jest.fn().mockReturnValue(jarPath);
  const configService = { get: configGet } as unknown as ConfigService;
  return new EpubcheckValidationAdapter(configService);
}

const VALID_JSON = JSON.stringify({ messages: [] });

const JSON_WITH_WARNING = JSON.stringify({
  messages: [
    { severity: 'WARNING', ID: 'OPF-001', message: 'Missing recommended element.', locations: [] },
  ],
});

const JSON_WITH_ERROR = JSON.stringify({
  messages: [
    { severity: 'ERROR', ID: 'RSC-005', message: 'element or attribute not allowed here', locations: [] },
  ],
});

// ─── Mocking child_process and fs/promises ────────────────────────────────────

jest.mock('node:child_process');
jest.mock('node:fs/promises');

import { execFile } from 'node:child_process';
import { writeFile, unlink, readFile } from 'node:fs/promises';

const execFileMock = execFile as jest.MockedFunction<typeof execFile>;
const writeFileMock = writeFile as jest.MockedFunction<typeof writeFile>;
const unlinkMock = unlink as jest.MockedFunction<typeof unlink>;
const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

/** Wraps execFile mock to simulate promisify(execFile) behavior. */
function mockExecOk() {
  execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
    if (cb) cb(null, '', '');
    return {} as any;
  });
}

function mockExecFail(err: Error) {
  execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
    if (cb) cb(err, '', '');
    return {} as any;
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EpubcheckValidationAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
  });

  describe('EPUBCHECK_JAR_PATH absent', () => {
    it('returns erros_criticos with CONFIG-001 code without spawning java', async () => {
      const adapter = buildAdapter(undefined);
      const report = await adapter.validate(Buffer.from('epub'));
      expect(report.verdict).toBe(EpubcheckStatus.ERROS_CRITICOS);
      expect(report.messages).toHaveLength(1);
      expect(report.messages[0]!.code).toBe('CONFIG-001');
      expect(report.messages[0]!.severity).toBe(ValidationSeverity.ERROR);
      // No child process spawned
      expect(execFileMock).not.toHaveBeenCalled();
    });
  });

  describe('happy path — no errors in ePub', () => {
    it('returns VALIDO verdict when epubcheck JSON has no messages', async () => {
      mockExecOk();
      readFileMock.mockResolvedValue(VALID_JSON as any);
      const adapter = buildAdapter('/opt/epubcheck.jar');
      const report = await adapter.validate(Buffer.from('epub-bytes'));
      expect(report.verdict).toBe(EpubcheckStatus.VALIDO);
      expect(report.messages).toHaveLength(0);
    });
  });

  describe('warnings only — ePub can still be published', () => {
    it('returns AVISOS verdict when epubcheck JSON has only warnings', async () => {
      mockExecOk();
      readFileMock.mockResolvedValue(JSON_WITH_WARNING as any);
      const adapter = buildAdapter('/opt/epubcheck.jar');
      const report = await adapter.validate(Buffer.from('epub-bytes'));
      expect(report.verdict).toBe(EpubcheckStatus.AVISOS);
      expect(report.messages[0]!.severity).toBe(ValidationSeverity.WARNING);
    });
  });

  describe('errors in ePub', () => {
    it('returns ERROS_CRITICOS verdict when epubcheck JSON has ERROR messages', async () => {
      // epubcheck exits non-zero when errors found; adapter reads JSON anyway
      mockExecFail(new Error('Process exited with code 1'));
      // Report file IS present (epubcheck wrote it with error details)
      readFileMock.mockResolvedValue(JSON_WITH_ERROR as any);
      const adapter = buildAdapter('/opt/epubcheck.jar');
      const report = await adapter.validate(Buffer.from('epub-bytes'));
      expect(report.verdict).toBe(EpubcheckStatus.ERROS_CRITICOS);
      expect(report.messages[0]!.severity).toBe(ValidationSeverity.ERROR);
    });
  });

  describe('process crash — JRE absent or jar corrupt', () => {
    it('returns erros_criticos with CONFIG-001 code when java is not found', async () => {
      mockExecFail(new Error('ENOENT: java not found'));
      // JSON report file does not exist (java crashed before writing it)
      readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const adapter = buildAdapter('/opt/epubcheck.jar');
      const report = await adapter.validate(Buffer.from('epub-bytes'));
      expect(report.verdict).toBe(EpubcheckStatus.ERROS_CRITICOS);
      expect(report.messages).toHaveLength(1);
      // Process-level error code (CONFIG-001 is the fallback for process errors)
      expect(report.messages[0]!.code).toBe('CONFIG-001');
    });
  });

  describe('cleanup guarantee', () => {
    it('removes temp files even when the process throws', async () => {
      mockExecFail(new Error('crash'));
      readFileMock.mockRejectedValue(new Error('ENOENT'));
      const adapter = buildAdapter('/opt/epubcheck.jar');
      await adapter.validate(Buffer.from('epub-bytes'));
      // unlink must have been called for both epub and json temp files
      expect(unlinkMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('severity mapping', () => {
    it('maps FATAL severity to error domain value', async () => {
      const jsonWithFatal = JSON.stringify({
        messages: [{ severity: 'FATAL', ID: 'OPF-XYZ', message: 'Fatal error.' }],
      });
      mockExecOk();
      readFileMock.mockResolvedValue(jsonWithFatal as any);
      const adapter = buildAdapter('/opt/epubcheck.jar');
      const report = await adapter.validate(Buffer.from('epub'));
      expect(report.verdict).toBe(EpubcheckStatus.ERROS_CRITICOS);
      expect(report.messages[0]!.severity).toBe(ValidationSeverity.ERROR);
    });
  });
});
