-- Migration 20260101000003: Add Mutual Funds as distinct institutional asset class
-- Separates direct listed equities and mutual fund schemes for precise asset allocation and taxation

INSERT INTO public.asset_classes (id, name, description, color_hex, display_order)
VALUES
  ('equity', 'Equities & Stocks', 'NSE/BSE listed stocks, shares, and Demat holdings', '#3b82f6', 1),
  ('mutual_fund', 'Mutual Funds', 'Direct & regular mutual fund folios, SIPs, ELSS', '#06b6d4', 2),
  ('fixed_income', 'Fixed Income & Debt', 'Fixed deposits (FD), PPF, EPF, government bonds', '#8b5cf6', 3),
  ('commodity', 'Gold & Precious Metals', 'Sovereign Gold Bonds (SGB), physical 24K gold, silver', '#eab308', 4),
  ('real_estate', 'Real Estate & Land', 'Primary residence, commercial property, Indian REITs', '#f59e0b', 5),
  ('cash', 'Cash & Liquid Savings', 'Savings accounts, emergency fund, liquid savings', '#10b981', 6),
  ('crypto', 'Digital Assets & Crypto', 'Major cryptocurrencies (subject to Indian VDA tax)', '#ec4899', 7),
  ('alternative', 'Alternative & Startups', 'Angel investments, private equity, collectibles', '#6366f1', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_hex = EXCLUDED.color_hex,
  display_order = EXCLUDED.display_order;
