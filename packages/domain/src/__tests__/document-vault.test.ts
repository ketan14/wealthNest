import { describe, it, expect } from 'vitest';
import {
  validateDocumentUpload,
  buildVaultStoragePath,
  summarizeDocumentVault,
  formatFileSize,
  FamilyDocument,
  MAX_VAULT_FILE_SIZE_BYTES,
} from '../vault/document-vault.js';

describe('Family Document Vault Domain Logic (VAULT-DOC-01)', () => {
  it('validates valid PDF and image uploads and rejects oversized or unsupported files', () => {
    const valid = validateDocumentUpload({
      title: 'Shamalbhai HUF Deed',
      category: 'huf_deed',
      fileName: 'huf-deed-2020.pdf',
      fileSizeBytes: 1024 * 500,
      mimeType: 'application/pdf',
    });
    expect(valid.isValid).toBe(true);

    const oversized = validateDocumentUpload({
      title: 'Huge Scan',
      category: 'property_deed',
      fileName: 'scan.pdf',
      fileSizeBytes: MAX_VAULT_FILE_SIZE_BYTES + 1,
      mimeType: 'application/pdf',
    });
    expect(oversized.isValid).toBe(false);
    expect(oversized.error).toMatch(/maximum allowed vault size/i);

    const badMime = validateDocumentUpload({
      title: 'Executable',
      category: 'other',
      fileName: 'malware.exe',
      fileSizeBytes: 2048,
      mimeType: 'application/x-msdownload',
    });
    expect(badMime.isValid).toBe(false);
    expect(badMime.error).toMatch(/Unsupported file format/i);

    const badCategory = validateDocumentUpload({
      title: 'Test Doc',
      category: 'invalid_cat',
      fileName: 'test.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
    });
    expect(badCategory.isValid).toBe(false);
  });

  it('builds canonical RLS-safe storage paths and sanitizes traversal characters', () => {
    const path = buildVaultStoragePath(
      'user-123',
      'doc-456',
      '../../Ketan PAN Card (2025).pdf'
    );
    expect(path).toBe('user-123/doc-456/.._.._Ketan_PAN_Card__2025_.pdf');
    expect(path.startsWith('user-123/doc-456/')).toBe(true);
  });

  it('summarizes vault counts, storage bytes, and expiring/expired policies', () => {
    const docs: FamilyDocument[] = [
      {
        id: 'd1',
        userId: 'u1',
        memberId: 'mem-huf',
        title: 'HUF Deed',
        category: 'huf_deed',
        fileName: 'huf.pdf',
        fileSizeBytes: 1024 * 1024,
        mimeType: 'application/pdf',
        storagePath: 'u1/d1/huf.pdf',
        isEncrypted: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'd2',
        userId: 'u1',
        memberId: 'mem-self',
        title: 'Health Insurance',
        category: 'insurance_policy',
        fileName: 'health.pdf',
        fileSizeBytes: 512 * 1024,
        mimeType: 'application/pdf',
        storagePath: 'u1/d2/health.pdf',
        expiryDate: '2026-11-25', // Expiring within 30 days of 2026-11-13
        isEncrypted: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'd3',
        userId: 'u1',
        memberId: 'mem-spouse',
        title: 'Old Motor Policy',
        category: 'insurance_policy',
        fileName: 'motor.pdf',
        fileSizeBytes: 256 * 1024,
        mimeType: 'application/pdf',
        storagePath: 'u1/d3/motor.pdf',
        expiryDate: '2026-10-01', // Expired before 2026-11-13
        isEncrypted: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const summary = summarizeDocumentVault(docs, new Date('2026-11-13T00:00:00Z'));
    expect(summary.totalDocuments).toBe(3);
    expect(summary.countsByCategory.huf_deed).toBe(1);
    expect(summary.countsByCategory.insurance_policy).toBe(2);
    expect(summary.expiringSoonCount).toBe(1);
    expect(summary.expiredCount).toBe(1);
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
  });
});

