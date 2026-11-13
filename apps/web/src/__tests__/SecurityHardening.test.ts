import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateStrongPassword,
  PASSWORD_MIN_LENGTH,
  validatePasswordChange,
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
  validateVaultFileBlobSignature,
  validateVaultFileSignature,
} from '../lib/validation/import-file';
import { PdfJsTextExtractorAdapter } from '../lib/pdf/pdfjs-extractor.adapter';
import { SupabaseDocumentVaultAdapter } from '../lib/supabase/document-vault.adapter';
import { supabase } from '../lib/supabase/client';

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

    it('validates password change confirmation matching alongside complexity', () => {
      expect(validatePasswordChange('short', '')).toEqual({
        password: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
        confirmPassword: 'Please confirm your new password',
      });
      expect(validatePasswordChange('WealthNest@2026!', 'Mismatch@2026!')).toEqual({
        confirmPassword: 'Passwords do not match',
      });
      expect(validatePasswordChange('WealthNest@2026!', 'WealthNest@2026!')).toEqual({});
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

    it('validates family-vault magic headers/extensions and blocks spoofed uploads before Supabase Storage', async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const webpBytes = new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPdata').buffer;
      const xlsxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      const htmlSpoof = new TextEncoder().encode('<html><script>alert(1)</script></html>');
      const exeSpoof = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

      expect(validateVaultFileSignature(pngBytes.slice().buffer, 'image/png', 'pan.png')).toBeNull();
      expect(validateVaultFileSignature(jpegBytes.slice().buffer, 'image/jpeg', 'id.jpg')).toBeNull();
      expect(validateVaultFileSignature(webpBytes, 'image/webp', 'scan.webp')).toBeNull();
      expect(
        validateVaultFileSignature(
          xlsxBytes.slice().buffer,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ledger.xlsx'
        )
      ).toBeNull();

      expect(validateVaultFileSignature(htmlSpoof.slice().buffer, 'text/csv', 'holdings.csv')).toContain(
        'HTML/script payload'
      );
      expect(validateVaultFileSignature(exeSpoof.slice().buffer, 'text/csv', 'evil.csv')).toContain(
        'Binary payload'
      );
      expect(
        validateVaultFileSignature(pngBytes.slice().buffer, 'application/pdf', 'fake.html')
      ).toContain('does not match declared file type');
      expect(
        await validateVaultFileBlobSignature(htmlSpoof, 'application/pdf', 'spoof.pdf')
      ).toContain('PDF document signature');
      const validPdfFile = new File([new TextEncoder().encode('%PDF-1.7\n')], 'deed.pdf', {
        type: 'application/pdf',
      });
      expect(await validateVaultFileBlobSignature(validPdfFile, 'application/pdf', 'deed.pdf')).toBeNull();

      const storageFromSpy = vi.spyOn(supabase.storage, 'from');
      const vaultAdapter = new SupabaseDocumentVaultAdapter();
      const spoofRes = await vaultAdapter.uploadDocument({
        userId: 'usr-1',
        title: 'Spoofed PAN PDF',
        category: 'identity_pan',
        fileName: 'spoof.pdf',
        fileSizeBytes: htmlSpoof.byteLength,
        mimeType: 'application/pdf',
        fileBlob: htmlSpoof,
      });

      expect(spoofRes.success).toBe(false);
      expect(storageFromSpy).not.toHaveBeenCalled();
    });
  });
});

