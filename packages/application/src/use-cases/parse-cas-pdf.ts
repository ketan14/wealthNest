import { Result, ok, err } from '@wealthnest/shared';
import { CasParserRegistry } from '@wealthnest/domain';
import { PdfExtractorPort } from '../ports/pdf-extractor.port.js';
import { CasPreviewDto, ImportCasItemDto } from '../ports/cas-import.port.js';

export class ParseCasPdfUseCase {
  private readonly parserRegistry: CasParserRegistry;

  constructor(private readonly pdfExtractor: PdfExtractorPort) {
    this.parserRegistry = new CasParserRegistry();
  }

  async execute(pdfBytes: ArrayBuffer, password?: string): Promise<Result<CasPreviewDto>> {
    // 1. Enforce file size limit (25 MB max)
    const MAX_SIZE_BYTES = 25 * 1024 * 1024;
    if (!pdfBytes || pdfBytes.byteLength === 0) {
      return err(new Error('Uploaded file is empty. Please select a valid CAS statement PDF.'));
    }
    if (pdfBytes.byteLength > MAX_SIZE_BYTES) {
      return err(new Error('File size exceeds the 25 MB limit. Please upload a standard CAS statement.'));
    }

    // 2. Extract raw text pages from PDF via port
    const extractionResult = await this.pdfExtractor.extractPages(pdfBytes, password);

    if (!extractionResult.success) {
      const errMsg = extractionResult.error.message.toLowerCase();
      if (
        errMsg.includes('password') ||
        errMsg.includes('encrypt') ||
        errMsg.includes('needpassword') ||
        errMsg.includes('bad decrypt')
      ) {
        return err(
          new Error(
            'The PDF is password protected. Please provide the document password (e.g., PAN + DOB DDMMYYYY).'
          )
        );
      }
      return err(new Error(`Failed to read PDF: ${extractionResult.error.message}`));
    }

    const { pages } = extractionResult.value;
    if (pages.length === 0 || pages.every((p) => p.trim().length === 0)) {
      return err(
        new Error(
          'No text content could be extracted from this PDF. It may be an image-only scanned document.'
        )
      );
    }

    // 3. Detect statement provider and parse holdings via domain engine
    const parsed = this.parserRegistry.detectAndParse(pages);

    if (parsed.holdings.length === 0) {
      return err(
        new Error(
          `Detected provider "${parsed.provider}", but could not find any recognizable holding tables with valid ISINs.`
        )
      );
    }

    // 4. Map to preview DTO
    const items: ImportCasItemDto[] = parsed.holdings.map((h) => {
      const unitCostCents = h.reportedNavOrPrice
        ? Number(h.reportedNavOrPrice.cents)
        : Math.round(Number(h.reportedMarketValue.cents) / (h.quantity || 1));

      return {
        isin: h.isin,
        name: h.name,
        assetClassId: h.assetClassId,
        quantity: h.quantity,
        unitCostCents,
        currentValueCents: Number(h.reportedMarketValue.cents),
        currency: h.currency,
        selected: true,
      };
    });

    return ok({
      provider: parsed.provider,
      statementDate: parsed.statementDate,
      items,
      totalReportedValueCents: Number(parsed.totalReportedValue.cents),
      warnings: parsed.warnings,
    });
  }
}
