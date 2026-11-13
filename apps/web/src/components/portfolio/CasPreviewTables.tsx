import { ImportCasItemDto, ImportCasTransactionDto } from '@wealthnest/application';
import { Badge } from '@/components/ui/Badge';

interface CasPreviewTablesProps {
  activeTab: 'equities' | 'mutual_funds' | 'transactions';
  equities: ImportCasItemDto[];
  selectedEquities: ImportCasItemDto[];
  equitiesSelectedValueCents: number;
  equitiesTotalValueCents: number;
  mutualFunds: ImportCasItemDto[];
  selectedMutualFunds: ImportCasItemDto[];
  mfSelectedValueCents: number;
  mfTotalValueCents: number;
  mfFolioCountsByIsin: Map<string, number>;
  transactions: ImportCasTransactionDto[];
  selectedTransactionsCount: number;
  onToggleItem: (item: ImportCasItemDto) => void;
  onSelectAllEquities: (select: boolean) => void;
  onSelectAllMutualFunds: (select: boolean) => void;
  onToggleTransaction: (index: number) => void;
  onSelectAllTransactions: (select: boolean) => void;
}

export function CasPreviewTables({
  activeTab,
  equities,
  selectedEquities,
  equitiesSelectedValueCents,
  equitiesTotalValueCents,
  mutualFunds,
  selectedMutualFunds,
  mfSelectedValueCents,
  mfTotalValueCents,
  mfFolioCountsByIsin,
  transactions,
  selectedTransactionsCount,
  onToggleItem,
  onSelectAllEquities,
  onSelectAllMutualFunds,
  onToggleTransaction,
  onSelectAllTransactions,
}: CasPreviewTablesProps) {
  if (activeTab === 'equities') {
    return (
      <>
        <div className="flex items-center justify-between text-xs bg-blue-500/5 p-2 rounded-lg border border-blue-500/20">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Found <span className="text-foreground font-semibold">{equities.length}</span> stocks
              & ETFs (
              <span className="text-blue-400 font-semibold">{selectedEquities.length}</span>{' '}
              selected)
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="font-mono text-foreground font-semibold">
              Selected: ₹
              {(equitiesSelectedValueCents / 100).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-muted-foreground text-[11px]">
              (of ₹
              {(equitiesTotalValueCents / 100).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
              )
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectAllEquities(true)}
              className="text-primary hover:underline font-semibold"
            >
              Select All
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={() => onSelectAllEquities(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="min-h-[300px] max-h-[460px] flex-1 overflow-y-auto border border-border/80 rounded-xl shadow-inner">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                <th className="py-2.5 px-3 w-10 text-center">Import</th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                  Security / Ticker
                </th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">ISIN</th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Demat Account</th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                  Shares
                </th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                  Price
                </th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                  Reported Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono">
              {equities.map((item: ImportCasItemDto, idx: number) => (
                <tr
                  key={`${item.isin}-${item.dematAccountId || idx}`}
                  className={`hover:bg-secondary/30 transition-colors ${
                    item.selected ? 'bg-secondary/15' : 'opacity-50'
                  }`}
                >
                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => onToggleItem(item)}
                      className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                      <span>{item.name}</span>
                      {item.ticker && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                          {item.ticker}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                    {item.isin}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                    {item.dematAccountId || 'Demat Main'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                    {item.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">
                    {item.unitCostCents
                      ? `₹${(item.unitCostCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-foreground">
                    ₹
                    {(item.currentValueCents / 100).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (activeTab === 'mutual_funds') {
    return (
      <>
        <div className="flex items-center justify-between text-xs bg-cyan-500/5 p-2 rounded-lg border border-cyan-500/20">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Found <span className="text-foreground font-semibold">{mutualFunds.length}</span>{' '}
              mutual fund folios (
              <span className="text-cyan-400 font-semibold">{selectedMutualFunds.length}</span>{' '}
              selected)
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="font-mono text-foreground font-semibold">
              Selected: ₹
              {(mfSelectedValueCents / 100).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-muted-foreground text-[11px]">
              (of ₹
              {(mfTotalValueCents / 100).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
              )
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectAllMutualFunds(true)}
              className="text-primary hover:underline font-semibold"
            >
              Select All
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={() => onSelectAllMutualFunds(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="min-h-[300px] max-h-[460px] flex-1 overflow-y-auto border border-border/80 rounded-xl shadow-inner">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                <th className="py-2.5 px-3 w-10 text-center">Import</th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                  Scheme / Fund Name
                </th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">AMC / Plan</th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Folio No.</th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">ISIN</th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                  Units
                </th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                  NAV
                </th>
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                  Reported Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono">
              {mutualFunds.map((item: ImportCasItemDto, idx: number) => {
                const hasMultipleFolios = (mfFolioCountsByIsin.get(item.isin) || 0) > 1;

                return (
                  <tr
                    key={`${item.isin}-${item.folioNumber || idx}`}
                    className={`hover:bg-secondary/30 transition-colors ${
                      item.selected ? 'bg-secondary/15' : 'opacity-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => onToggleItem(item)}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{item.name}</span>
                        {hasMultipleFolios && (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30 px-1 py-0"
                            title="This scheme is held across multiple distinct folios in your statement."
                          >
                            Multiple Folios
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="text-xs text-foreground font-medium">
                        {item.amcName || 'Mutual Fund'}
                      </div>
                      {item.schemePlan && (
                        <span className="text-[10px] text-muted-foreground">{item.schemePlan}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-foreground font-semibold">
                      {item.folioNumber || 'Direct'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-muted-foreground">
                      {item.isin}
                    </td>
                    <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                      {item.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {item.unitCostCents
                        ? `₹${(item.unitCostCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground">
                      ₹
                      {(item.currentValueCents / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between text-xs bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/20">
        <span className="text-muted-foreground">
          Found <span className="text-foreground font-semibold">{transactions.length}</span>{' '}
          historical transactions (
          <span className="text-emerald-400 font-semibold">{selectedTransactionsCount}</span>{' '}
          selected)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectAllTransactions(true)}
            className="text-primary hover:underline font-semibold"
          >
            Select All
          </button>
          <span className="text-muted-foreground">•</span>
          <button
            type="button"
            onClick={() => onSelectAllTransactions(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="min-h-[300px] max-h-[460px] flex-1 overflow-y-auto border border-border/80 rounded-xl shadow-inner">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-muted-foreground sticky top-0 backdrop-blur-md z-10">
              <th className="py-2.5 px-3 w-10 text-center">Import</th>
              <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Date</th>
              <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Type</th>
              <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                Scheme / Fund Name
              </th>
              <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                Units
              </th>
              <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">NAV</th>
              <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 font-mono">
            {transactions.map((tx, idx) => (
              <tr
                key={idx}
                className={`hover:bg-secondary/30 transition-colors ${
                  tx.selected ? 'bg-secondary/15' : 'opacity-50'
                }`}
              >
                <td className="py-2.5 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={tx.selected}
                    onChange={() => onToggleTransaction(idx)}
                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                  />
                </td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground whitespace-nowrap">
                  {tx.date}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  {tx.type === 'sell' ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/30 uppercase font-semibold"
                    >
                      Redemption
                    </Badge>
                  ) : tx.type === 'dividend' ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30 uppercase font-semibold"
                    >
                      Dividend
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 uppercase font-semibold"
                    >
                      Purchase (SIP)
                    </Badge>
                  )}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                    <span>{tx.schemeName}</span>
                    {tx.ticker && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold">
                        {tx.ticker}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                    {tx.description}
                  </p>
                </td>
                <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                  {tx.type === 'sell' ? '-' : '+'}
                  {tx.units
                    ? tx.units.toLocaleString('en-IN', { maximumFractionDigits: 4 })
                    : '—'}
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">
                  {tx.navPriceCents
                    ? `₹${(tx.navPriceCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                    : '—'}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-foreground">
                  ₹
                  {(tx.amountCents / 100).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

