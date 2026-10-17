/**
 * Pure non-domain formatting helpers
 */

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function isValidISODate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr.slice(0, 10));
}
