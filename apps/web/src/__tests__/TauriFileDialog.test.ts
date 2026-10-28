import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveTextFile, openTextFile } from '../lib/tauri/tauri-file-dialog';

describe('Phase 10: Native File Dialog & Browser Fallback', () => {
  const originalTauri = (window as unknown as { __TAURI__?: unknown }).__TAURI__;

  beforeEach(() => {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  });

  afterEach(() => {
    if (originalTauri) {
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = originalTauri;
    } else {
      delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
    }
  });

  describe('saveTextFile', () => {
    it('TC-10-02A: invokes native Tauri dialog.save and fs.writeTextFile when in Tauri runtime', async () => {
      const mockSave = vi.fn().mockResolvedValue('/home/user/portfolio_backup.json');
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
        dialog: { save: mockSave },
        fs: { writeTextFile: mockWrite },
      };

      const result = await saveTextFile({
        defaultPath: 'portfolio_backup.json',
        content: '{"holdings":[]}',
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      });

      expect(mockSave).toHaveBeenCalledWith({
        defaultPath: 'portfolio_backup.json',
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      });
      expect(mockWrite).toHaveBeenCalledWith('/home/user/portfolio_backup.json', '{"holdings":[]}');
      expect(result.success).toBe(true);
      expect(result.filePath).toBe('/home/user/portfolio_backup.json');
    });

    it('TC-10-02B: handles native save dialog cancellation gracefully', async () => {
      const mockSave = vi.fn().mockResolvedValue(null);
      const mockWrite = vi.fn();

      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
        dialog: { save: mockSave },
        fs: { writeTextFile: mockWrite },
      };

      const result = await saveTextFile({
        defaultPath: 'portfolio_backup.json',
        content: '{"holdings":[]}',
      });

      expect(mockSave).toHaveBeenCalled();
      expect(mockWrite).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/cancelled/i);
    });

    it('TC-10-02C: falls back to browser Blob download in web runtime', async () => {
      const clickMock = vi.fn();
      const originalCreateElement = document.createElement.bind(document);

      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'a') {
          el.click = clickMock;
        }
        return el;
      });

      const result = await saveTextFile({
        defaultPath: 'wealthnest_export.json',
        content: '{"version":"1.0.0"}',
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('wealthnest_export.json');
      expect(clickMock).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('openTextFile', () => {
    it('TC-10-02D: invokes native Tauri dialog.open and fs.readTextFile when in Tauri runtime', async () => {
      const mockOpen = vi.fn().mockResolvedValue('/home/user/portfolio_backup.json');
      const mockRead = vi.fn().mockResolvedValue('{"version":"1.0.0","holdings":[]}');

      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
        dialog: { open: mockOpen },
        fs: { readTextFile: mockRead },
      };

      const result = await openTextFile({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        directory: false,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });
      expect(mockRead).toHaveBeenCalledWith('/home/user/portfolio_backup.json');
      expect(result.success).toBe(true);
      expect(result.content).toBe('{"version":"1.0.0","holdings":[]}');
      expect(result.filePath).toBe('/home/user/portfolio_backup.json');
    });

    it('TC-10-02E: handles native open dialog cancellation gracefully', async () => {
      const mockOpen = vi.fn().mockResolvedValue(null);

      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
        dialog: { open: mockOpen },
        fs: { readTextFile: vi.fn() },
      };

      const result = await openTextFile();

      expect(mockOpen).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/cancelled/i);
    });
  });
});
