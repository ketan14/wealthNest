import React, { useState } from 'react';
import { Table, BarChart3 } from 'lucide-react';
import { Button } from './Button';

export interface AccessibleChartRow {
  readonly label: string;
  readonly values: readonly string[];
}

interface AccessibleChartContainerProps {
  title: string;
  description?: string;
  headers: readonly string[];
  rows: readonly AccessibleChartRow[];
  children: React.ReactNode;
}

/**
 * Wraps SVG charts with an always-available screen-reader data table fallback
 * and an interactive keyboard-accessible "View Data Table" toggle.
 */
export function AccessibleChartContainer({
  title,
  description,
  headers,
  rows,
  children,
}: AccessibleChartContainerProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div role="region" aria-label={title} className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowTable((prev) => !prev)}
          aria-pressed={showTable}
          className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {showTable ? (
            <>
              <BarChart3 className="w-3.5 h-3.5" />
              View Chart
            </>
          ) : (
            <>
              <Table className="w-3.5 h-3.5" />
              View Data Table
            </>
          )}
        </Button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              {title}
              {description ? ` — ${description}` : ''}
            </caption>
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                {headers.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row, idx) => (
                <tr key={`${row.label}-${idx}`} className="hover:bg-secondary/20">
                  <th scope="row" className="px-3 py-2 font-medium text-foreground">
                    {row.label}
                  </th>
                  {row.values.map((val, vIdx) => (
                    <td key={vIdx} className="px-3 py-2 font-mono text-muted-foreground">
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {children}
          {/* Screen-reader fallback table when visual chart is active */}
          <table className="sr-only">
            <caption>
              {title}
              {description ? ` — ${description}` : ''}
            </caption>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.label}-sr-${idx}`}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((val, vIdx) => (
                    <td key={vIdx}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
