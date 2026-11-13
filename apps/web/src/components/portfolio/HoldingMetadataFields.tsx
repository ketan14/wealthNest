import { AssetClassDefinition } from '@wealthnest/domain';

export const FALLBACK_ASSET_CLASSES: AssetClassDefinition[] = [
  {
    id: 'equity',
    name: 'Equities & Stocks',
    colorHex: '#3b82f6',
    displayOrder: 1,
    description: 'Listed shares and Demat equities',
  },
  {
    id: 'mutual_fund',
    name: 'Mutual Funds',
    colorHex: '#06b6d4',
    displayOrder: 2,
    description: 'Direct and regular mutual fund folios & SIPs',
  },
  {
    id: 'fixed_income',
    name: 'Fixed Income & Debt',
    colorHex: '#8b5cf6',
    displayOrder: 3,
    description: '',
  },
  {
    id: 'commodity',
    name: 'Gold & Precious Metals',
    colorHex: '#eab308',
    displayOrder: 4,
    description: '',
  },
  {
    id: 'real_estate',
    name: 'Real Estate & Land',
    colorHex: '#f59e0b',
    displayOrder: 5,
    description: '',
  },
  {
    id: 'cash',
    name: 'Cash & Liquid Savings',
    colorHex: '#10b981',
    displayOrder: 6,
    description: '',
  },
  {
    id: 'crypto',
    name: 'Digital Assets & Crypto',
    colorHex: '#ec4899',
    displayOrder: 7,
    description: '',
  },
  {
    id: 'alternative',
    name: 'Alternative & Startups',
    colorHex: '#6366f1',
    displayOrder: 8,
    description: '',
  },
];

interface HoldingMetadataFieldsProps {
  isMutualFund: boolean;
  isEquity: boolean;
  name: string;
  onNameChange: (val: string) => void;
  ticker: string;
  onTickerChange: (val: string) => void;
  isin: string;
  onIsinChange: (val: string) => void;
  amcName: string;
  onAmcNameChange: (val: string) => void;
  folioNumber: string;
  onFolioNumberChange: (val: string) => void;
  schemePlan: string;
  onSchemePlanChange: (val: string) => void;
  dematAccountId: string;
  onDematAccountIdChange: (val: string) => void;
}

/**
 * Asset-class-specific metadata fields (Mutual Fund vs Equity vs Other) for AddHoldingModal.
 */
export function HoldingMetadataFields({
  isMutualFund,
  isEquity,
  name,
  onNameChange,
  ticker,
  onTickerChange,
  isin,
  onIsinChange,
  amcName,
  onAmcNameChange,
  folioNumber,
  onFolioNumberChange,
  schemePlan,
  onSchemePlanChange,
  dematAccountId,
  onDematAccountIdChange,
}: HoldingMetadataFieldsProps) {
  if (isMutualFund) {
    return (
      <>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Scheme / Fund Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Bandhan Large & Mid Cap Fund"
            className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">AMC Name</label>
            <input
              type="text"
              value={amcName}
              onChange={(e) => onAmcNameChange(e.target.value)}
              placeholder="e.g. Bandhan Mutual Fund"
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Folio Number
            </label>
            <input
              type="text"
              value={folioNumber}
              onChange={(e) => onFolioNumberChange(e.target.value)}
              placeholder="e.g. 209928335/70"
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Plan / Option
            </label>
            <select
              value={schemePlan}
              onChange={(e) => onSchemePlanChange(e.target.value)}
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Direct - Growth">Direct - Growth</option>
              <option value="Direct - IDCW">Direct - IDCW</option>
              <option value="Regular - Growth">Regular - Growth</option>
              <option value="Regular - IDCW">Regular - IDCW</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">ISIN</label>
            <input
              type="text"
              value={isin}
              onChange={(e) => onIsinChange(e.target.value)}
              placeholder="INF194K01V89"
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </>
    );
  }

  if (isEquity) {
    return (
      <>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Company / Security Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Reliance Industries Limited"
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              NSE/BSE Ticker
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => onTickerChange(e.target.value)}
              placeholder="RELIANCE"
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">ISIN</label>
            <input
              type="text"
              value={isin}
              onChange={(e) => onIsinChange(e.target.value)}
              placeholder="INE002A01018"
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Demat Account ID / DP
            </label>
            <input
              type="text"
              value={dematAccountId}
              onChange={(e) => onDematAccountIdChange(e.target.value)}
              placeholder="e.g. 1208160000000000"
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2">
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Asset Name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Sovereign Gold Bond, PPF, Real Estate"
          className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Ticker / Code
        </label>
        <input
          type="text"
          value={ticker}
          onChange={(e) => onTickerChange(e.target.value)}
          placeholder="CODE"
          className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}
