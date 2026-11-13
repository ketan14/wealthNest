import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateStrongPassword,
  PASSWORD_MIN_LENGTH,
  validatePasswordComplexity,
} from '../lib/validation/password';
import {
  hasPdfMagicHeader,
  MAX_BROKER_CSV_BYTES,
  MAX_CAS_PDF_BYTES,
  MAX_CAS_PDF_PAGES,
  MAX_CSV_ROWS,
  validateCsvTextBounds,
  validateFinancialImportFile,
} from '../lib/validation/import-file';
import { PdfJsTextExtractorAdapter } from '../lib/pdf/pdfjs-extractor.adapter';

describe('Security Hardening Helpers (AUTH-02 & 3P-02)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('pdfjs-dist');
  });

  describe('Shared Password Policy & CSPRNG Generator (AUTH-02)', () => {
    it('enforces minimum 12-char length and all 4 character classes', () => {
      expect(validatePasswordComplexity('')).toBe('Password is required');
      expect(validatePasswordComplexity('Short@1')).toBe(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
      );
      expect(validatePasswordComplexity('nouppercase12@')).toContain('uppercase');
      expect(validatePasswordComplexity('NOLOWERCASE12@')).toContain('lowercase');
      expect(validatePasswordComplexity('NoDigitsPassword@')).toContain('number');
      expect(validatePasswordComplexity('NoSpecialChar123')).toContain('special');
      expect(validatePasswordComplexity('WealthNest@2026!')).toBeNull();
    });

    it('generates cryptographically distinct passwords compliant with complexity policy', () => {
      const p1 = generateStrongPassword(16);
      const p2 = generateStrongPassword(16);

      expect(p1).toHaveLength(16);
      expect(p2).toHaveLength(16);
      expect(p1).not.toBe(p2);
      expect(p1.startsWith('WealthNest@')).toBe(false);
      expect(validatePasswordComplexity(p1)).toBeNull();
      expect(validatePasswordComplexity(p2)).toBeNull();
    });
  });

  describe('Financial Import Bounds & PDF.js Safe Extraction (3P-02)', () => {
    it('validates %PDF- magic header and rejects spoofed content', () => {
      const validPdfBytes = new TextEncoder().encode('%PDF-1.7\n...').buffer;
      const htmlBytes = new TextEncoder().encode('<script>alert(1)</script>').buffer;

      expect(hasPdfMagicHeader(validPdfBytes)).toBe(true);
      expect(hasPdfMagicHeader(htmlBytes)).toBe(false);
      expect(hasPdfMagicHeader(new ArrayBuffer(2))).toBe(false);
    });

    it('enforces file size, extension, and row bounds for CAS PDF and broker CSV imports', () => {
      expect(
        validateFinancialImportFile(
          { name: 'statement.pdf', size: 1024, type: 'application/pdf' },
          'pdf'
        )
      ).toBeNull();
      expect(
        validateFinancialImportFile(
          { name: 'huge.pdf', size: MAX_CAS_PDF_BYTES + 1, type: 'application/pdf' },
          'pdf'
        )
      ).toContain('20 MiB');
      expect(
        validateFinancialImportFile(
          { name: 'payload.html', size: 512, type: 'text/html' },
          'pdf'
        )
      ).toContain('.pdf');

      expect(
        validateFinancialImportFile({ name: 'kite.csv', size: 1024, type: 'text/csv' }, 'csv')
      ).toBeNull();
      expect(
        validateFinancialImportFile(
          { name: 'huge.csv', size: MAX_BROKER_CSV_BYTES + 1, type: 'text/csv' },
          'csv'
        )
      ).toContain('5 MiB');

      const tooManyRows = Array.from({ length: MAX_CSV_ROWS + 1 }, () => 'a,b,c').join('\n');
      expect(validateCsvTextBounds(tooManyRows)).toContain('rows');
    });

    it('rejects invalid PDF signatures and enforces isEvalSupported: false + page limit', async () => {
      const extractor = new PdfJsTextExtractorAdapter();

      const badRes = await extractor.extractPages(
        new TextEncoder().encode('NOT_A_PDF_HEADER').buffer
      );
      expect(badRes.success).toBe(false);
      if (!badRes.success) {
        expect(badRes.error.message).toContain('Invalid PDF file signature');
      }

      const getDocumentMock = vi.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: MAX_CAS_PDF_PAGES + 1,
          getPage: vi.fn(),
        }),
      });
      vi.doMock('pdfjs-dist', () => ({
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument: getDocumentMock,
      }));

      const validHeaderBytes = new TextEncoder().encode('%PDF-1.7\n').buffer;
      const pageLimitRes = await extractor.extractPages(validHeaderBytes);

      expect(getDocumentMock).toHaveBeenCalledWith(
        expect.objectContaining({ isEvalSupported: false })
      );
      expect(pageLimitRes.success).toBe(false);
      if (!pageLimitRes.success) {
        expect(pageLimitRes.error.message).toContain(`${MAX_CAS_PDF_PAGES}-page`);
      }
    });
  });
});

