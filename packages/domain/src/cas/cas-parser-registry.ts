import { ICasStatementParser } from './cas-parser.interface.js';
import { CdslCasParser } from './cdsl-cas-parser.js';
import { NsdlCasParser } from './nsdl-cas-parser.js';
import { ParsedCasStatement } from './cas-types.js';

export class CasParserRegistry {
  private readonly parsers: ICasStatementParser[];

  constructor() {
    this.parsers = [new CdslCasParser(), new NsdlCasParser()];
  }

  detectAndParse(pages: readonly string[]): ParsedCasStatement {
    const headerSample = pages.slice(0, 3).join('\n');

    for (const parser of this.parsers) {
      if (parser.canParse(headerSample)) {
        return parser.parse(pages);
      }
    }

    // Fallback: If neither strict provider match hits, try CDSL parser as default Indian CAS format
    const fallbackParser = this.parsers[0]!;
    const parsed = fallbackParser.parse(pages);
    return {
      ...parsed,
      provider: 'UNKNOWN',
      warnings: [
        'Could not unambiguously detect NSDL or CDSL statement headers. Extracted holdings using generic Indian depository rules.',
        ...parsed.warnings,
      ],
    };
  }
}
