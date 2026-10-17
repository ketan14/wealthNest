import { Result } from '@wealthnest/shared';

export interface PdfExtractionResult {
  readonly pages: readonly string[];
  readonly totalPageCount: number;
}

export interface PdfExtractorPort {
  extractPages(pdfBytes: ArrayBuffer, password?: string): Promise<Result<PdfExtractionResult>>;
}
