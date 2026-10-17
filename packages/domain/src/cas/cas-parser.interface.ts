import { ParsedCasStatement, StatementProvider } from './cas-types.js';

export interface ICasStatementParser {
  readonly provider: StatementProvider;
  canParse(rawText: string): boolean;
  parse(pages: readonly string[]): ParsedCasStatement;
}
