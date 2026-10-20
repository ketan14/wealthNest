import { Result, ok, err } from '@wealthnest/shared';
import { PdfExtractorPort, PdfExtractionResult } from '@wealthnest/application';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker URL for Vite bundler
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Fallback if URL constructor fails in test runner
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
}

export class PdfJsTextExtractorAdapter implements PdfExtractorPort {
  async extractPages(
    pdfBytes: ArrayBuffer,
    password?: string
  ): Promise<Result<PdfExtractionResult>> {
    try {
      // Load document into memory with optional password
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBytes),
        password: password || undefined,
        useSystemFonts: true,
      });

      const pdfDoc = await loadingTask.promise;
      const totalPageCount = pdfDoc.numPages;
      const pages: string[] = [];

      for (let pageNum = 1; pageNum <= totalPageCount; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Reconstruct text lines by checking line item Y coordinates
        const items = textContent.items as Array<{ str: string; transform?: number[] }>;
        let pageText = '';
        let lastY: number | null = null;

        for (const item of items) {
          const currentY = item.transform ? Math.round(item.transform[5] ?? 0) : null;

          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
            pageText += '\n';
          } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }

          pageText += item.str;
          lastY = currentY;
        }

        pages.push(pageText);
      }

      return ok({
        pages,
        totalPageCount,
      });
    } catch (e: unknown) {
      // PDF.js password exception handling
      const errorObj = e as { name?: string; message?: string };
      if (
        errorObj.name === 'PasswordException' ||
        errorObj.message?.includes('Password') ||
        errorObj.message?.includes('password')
      ) {
        return err(new Error('Password required to decrypt document'));
      }
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
