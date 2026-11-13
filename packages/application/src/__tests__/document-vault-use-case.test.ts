import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import {
  ManageDocumentVaultUseCase,
  DocumentVaultRepositoryPort,
  FamilyDocumentDto,
} from '../index.js';

describe('Application: ManageDocumentVaultUseCase (VAULT-DOC-01)', () => {
  const mockDocs: FamilyDocumentDto[] = [
    {
      id: 'doc-1',
      userId: 'user-ketan',
      memberId: 'mem-huf',
      title: 'Shamalbhai Vaghela HUF Deed',
      category: 'huf_deed',
      fileName: 'huf-deed.pdf',
      fileSizeBytes: 512000,
      mimeType: 'application/pdf',
      storagePath: 'user-ketan/doc-1/huf-deed.pdf',
      documentDate: '2018-04-01',
      isEncrypted: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const createMockRepo = (): DocumentVaultRepositoryPort => ({
    listDocumentsByUser: vi.fn().mockResolvedValue(ok(mockDocs)),
    uploadDocument: vi.fn().mockImplementation(async (params) =>
      ok({
        id: 'doc-2',
        userId: params.userId,
        memberId: params.memberId,
        title: params.title,
        category: params.category,
        fileName: params.fileName,
        fileSizeBytes: params.fileSizeBytes,
        mimeType: params.mimeType,
        storagePath: `${params.userId}/doc-2/${params.fileName}`,
        documentDate: params.documentDate,
        expiryDate: params.expiryDate,
        notes: params.notes,
        isEncrypted: Boolean(params.isEncrypted),
        createdAt: '2026-11-13T00:00:00Z',
        updatedAt: '2026-11-13T00:00:00Z',
      })
    ),
    getDocumentDownloadUrl: vi.fn().mockResolvedValue(ok('https://signed.example.com/doc-1')),
    deleteDocument: vi.fn().mockResolvedValue(ok(undefined)),
  });

  it('lists documents for an authenticated user', async () => {
    const repo = createMockRepo();
    const useCase = new ManageDocumentVaultUseCase(repo);

    const res = await useCase.listDocuments('user-ketan');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.value).toHaveLength(1);
      expect(res.value[0]?.title).toBe('Shamalbhai Vaghela HUF Deed');
    }
  });

  it('validates upload parameters before calling repository', async () => {
    const repo = createMockRepo();
    const useCase = new ManageDocumentVaultUseCase(repo);

    const badRes = await useCase.uploadDocument({
      userId: 'user-ketan',
      title: 'X',
      category: 'identity_pan',
      fileName: 'pan.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      fileBlob: new Uint8Array([1, 2, 3]),
    });
    expect(badRes.success).toBe(false);
    expect(repo.uploadDocument).not.toHaveBeenCalled();

    const goodRes = await useCase.uploadDocument({
      userId: 'user-ketan',
      memberId: 'mem-self',
      title: 'Ketan PAN Card',
      category: 'identity_pan',
      fileName: 'ketan-pan.pdf',
      fileSizeBytes: 204800,
      mimeType: 'application/pdf',
      fileBlob: new Uint8Array([1, 2, 3]),
    });
    expect(goodRes.success).toBe(true);
    expect(repo.uploadDocument).toHaveBeenCalledTimes(1);
  });

  it('retrieves signed download URL and deletes documents safely', async () => {
    const repo = createMockRepo();
    const useCase = new ManageDocumentVaultUseCase(repo);

    const urlRes = await useCase.getDownloadUrl('doc-1', 'user-ketan/doc-1/huf-deed.pdf', 'user-ketan');
    expect(urlRes.success).toBe(true);
    if (urlRes.success) {
      expect(urlRes.value).toBe('https://signed.example.com/doc-1');
    }

    const delRes = await useCase.deleteDocument('doc-1', 'user-ketan/doc-1/huf-deed.pdf', 'user-ketan');
    expect(delRes.success).toBe(true);
  });
});

