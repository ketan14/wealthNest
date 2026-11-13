import { HoldingDetailDto } from '@wealthnest/application';

// Demo initial positions tailored for Indian investors (India First)
export const DEMO_HOLDINGS: HoldingDetailDto[] = [
  {
    holdingId: 'demo-1',
    assetId: 'asset-1',
    name: 'Reliance Industries Ltd',
    ticker: 'RELIANCE',
    isin: 'INE002A01018',
    dematAccountId: '1208160000000000',
    assetClassId: 'equity',
    assetClassName: 'Equities & Stocks',
    assetClassColor: '#3b82f6',
    quantity: 80,
    unitCostCents: 250000, // ₹2,500.00
    currentValueCents: 23600000, // ₹2,36,000.00 (+₹36,000)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
  },
  {
    holdingId: 'demo-2',
    assetId: 'asset-2',
    name: 'Parag Parikh Flexi Cap Fund',
    ticker: 'PPFAS-FLEXI',
    isin: 'INF879O01019',
    amcName: 'PPFAS Mutual Fund',
    folioNumber: '10123456/90',
    schemePlan: 'Direct Plan - Growth',
    assetClassId: 'mutual_fund',
    assetClassName: 'Mutual Funds',
    assetClassColor: '#06b6d4',
    quantity: 1500,
    unitCostCents: 5500, // ₹55.00
    currentValueCents: 11000000, // ₹1,10,000.00 (+₹27,500)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-spouse',
    accountId: 'acc-groww',
  },
  {
    holdingId: 'demo-3',
    assetId: 'asset-3',
    name: 'Tata Consultancy Services',
    ticker: 'TCS',
    isin: 'INE467B01029',
    dematAccountId: '1208160000000000',
    assetClassId: 'equity',
    assetClassName: 'Equities & Stocks',
    assetClassColor: '#3b82f6',
    quantity: 40,
    unitCostCents: 360000, // ₹3,600.00
    currentValueCents: 16600000, // ₹1,66,000.00 (+₹22,000)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-huf',
    accountId: 'acc-icici',
  },
  {
    holdingId: 'demo-4',
    assetId: 'asset-4',
    name: 'Sovereign Gold Bond 2028',
    ticker: 'SGB-2028',
    isin: 'IN0020180017',
    dematAccountId: '1208160000000000',
    assetClassId: 'commodity',
    assetClassName: 'Gold & Precious Metals',
    assetClassColor: '#eab308',
    quantity: 30, // grams
    unitCostCents: 580000, // ₹5,800.00
    currentValueCents: 22950000, // ₹2,29,500.00 (+₹55,500)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
  },
  {
    holdingId: 'demo-2b',
    assetId: 'asset-2b',
    name: 'Bandhan Large & Mid Cap Fund',
    ticker: 'BANDHAN-LM',
    isin: 'INF194K01V89',
    amcName: 'Bandhan Mutual Fund',
    folioNumber: '209928335/70',
    schemePlan: 'Direct Plan - Growth',
    assetClassId: 'mutual_fund',
    assetClassName: 'Mutual Funds',
    assetClassColor: '#06b6d4',
    quantity: 2268.239,
    unitCostCents: 14720, // ₹147.20
    currentValueCents: 37671800, // ₹3,76,718.00
    currency: 'INR',
    costBasisVerified: false,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-child',
    accountId: 'acc-cams',
  },
  {
    holdingId: 'demo-5',
    assetId: 'asset-5',
    name: 'Public Provident Fund (PPF)',
    ticker: 'PPF',
    assetClassId: 'fixed_income',
    assetClassName: 'Fixed Income & Debt',
    assetClassColor: '#8b5cf6',
    quantity: 1,
    unitCostCents: 150000000, // ₹15,00,000.00 (15 Lakhs)
    currentValueCents: 150000000, // ₹15,00,000.00
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-self',
    accountId: 'acc-sbi-ppf',
  },
  {
    holdingId: 'demo-6',
    assetId: 'asset-6',
    name: 'Bank of Baroda Senior Citizen FD',
    ticker: 'BOB-FD',
    assetClassId: 'fixed_income',
    assetClassName: 'Fixed Income & Debt',
    assetClassColor: '#8b5cf6',
    quantity: 1,
    unitCostCents: 50000000, // ₹5,00,000.00 (5 Lakhs)
    currentValueCents: 50000000, // ₹5,00,000.00
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-mother',
    accountId: 'acc-bob-fd',
  },
  {
    holdingId: 'demo-7',
    assetId: 'asset-7',
    name: 'Emergency Bank Savings',
    ticker: 'CASH',
    assetClassId: 'cash',
    assetClassName: 'Cash & Liquid Savings',
    assetClassColor: '#10b981',
    quantity: 1,
    unitCostCents: 25000000, // ₹2,50,000.00 (2.5 Lakhs)
    currentValueCents: 25000000, // ₹2,50,000.00
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
  },
  {
    holdingId: 'demo-8',
    assetId: 'asset-8',
    name: 'Embassy Office Parks REIT',
    ticker: 'EMBASSY',
    isin: 'INE041025011',
    dematAccountId: '1208160000000000',
    assetClassId: 'real_estate',
    assetClassName: 'Real Estate & Land',
    assetClassColor: '#f59e0b',
    quantity: 600,
    unitCostCents: 34000, // ₹340.00
    currentValueCents: 23700000, // ₹2,37,000.00 (+₹33,000)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-huf',
    accountId: 'acc-icici',
  },
];

export const ASSET_CLASS_META_MAP: Record<string, { name: string; color: string }> = {
  equity: { name: 'Equities & Stocks', color: '#3b82f6' },
  mutual_fund: { name: 'Mutual Funds', color: '#06b6d4' },
  fixed_income: { name: 'Fixed Income & Debt', color: '#8b5cf6' },
  commodity: { name: 'Gold & Precious Metals', color: '#eab308' },
  real_estate: { name: 'Real Estate & Land', color: '#f59e0b' },
  cash: { name: 'Cash & Liquid Savings', color: '#10b981' },
  crypto: { name: 'Digital Assets & Crypto', color: '#ec4899' },
};

