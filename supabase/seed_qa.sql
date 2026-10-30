-- ==============================================================================
-- WealthNest QA Environment Seed Script: Anonymized Multi-Persona & History
-- Uses randomized/fictitious demo names for QA testing and privacy preservation.
-- Adheres strictly to Indian taxation conventions and zero floating-point drift.
--
-- Usage in Supabase SQL Editor:
--   1. Seed Primary QA Household (Family, Demats, Holdings, Trades, Goals, Loans):
--        SELECT public.seed_qa_primary_household(auth.uid());
--
--   2. Grant Platform Super Admin Role (Enables /admin Portal & Support Impersonation):
--        SELECT public.seed_qa_grant_admin(auth.uid());
--
--   3. Seed Secondary Test User (For Cross-Tenant Multi-User RLS Isolation Testing):
--        SELECT public.seed_qa_secondary_user(auth.uid());
-- ==============================================================================

-- ==============================================================================
-- 1. Helper: Grant Platform Admin Access
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.seed_qa_grant_admin(
  p_user_id uuid,
  p_role text DEFAULT 'super_admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user_id cannot be null';
  END IF;

  INSERT INTO public.platform_admin_roles (user_id, role, is_active, granted_at)
  VALUES (p_user_id, p_role, true, now())
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'success',
    'message', format('Granted platform role [%s] to user [%s]', p_role, p_user_id),
    'user_id', p_user_id,
    'role', p_role
  );
END;
$$;

-- ==============================================================================
-- 2. Primary Seed: Anonymized QA Household Persona & Complete Financial History
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.seed_qa_primary_household(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_primary_id uuid;
  v_spouse_id uuid;
  v_huf_id uuid;
  v_child_id uuid;
  v_parent_id uuid;

  v_zerodha_acc_id uuid;
  v_groww_acc_id uuid;
  v_hdfc_sec_acc_id uuid;
  v_bank_acc_id uuid;
  v_sgb_acc_id uuid;

  v_asset_hdfc uuid;
  v_asset_reliance uuid;
  v_asset_tcs uuid;
  v_asset_ppfc uuid;
  v_asset_sgb uuid;
  v_asset_fd uuid;

  v_liability_home uuid;
  v_trade_count int := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user_id cannot be null';
  END IF;

  -- 1. Family Members (Fictitious Random Names for QA Privacy)
  INSERT INTO public.family_members (user_id, name, relationship, pan_masked, color_hex, is_primary, notes)
  VALUES (p_user_id, 'Arjun Sharma', 'self', 'ABCDE1234F', '#0284c7', true, 'Primary Investor, age 38, tech consultant')
  RETURNING id INTO v_primary_id;

  INSERT INTO public.family_members (user_id, name, relationship, pan_masked, color_hex, is_primary, notes)
  VALUES (p_user_id, 'Pooja Sharma', 'spouse', 'BCDEF2345G', '#ec4899', false, 'Spouse, age 35, public sector officer')
  RETURNING id INTO v_spouse_id;

  INSERT INTO public.family_members (user_id, name, relationship, pan_masked, color_hex, is_primary, notes)
  VALUES (p_user_id, 'Harishbhai Sharma HUF', 'huf', 'CDEFG3456H', '#8b5cf6', false, 'HUF Karta, age 68, Section 112A ₹1,25,000 LTCG annual tax shield')
  RETURNING id INTO v_huf_id;

  INSERT INTO public.family_members (user_id, name, relationship, pan_masked, color_hex, is_primary, notes)
  VALUES (p_user_id, 'Ananya Sharma', 'child', 'DEFGH4567J', '#10b981', false, 'Daughter, age 6, 1st standard, compounding & higher education goals')
  RETURNING id INTO v_child_id;

  INSERT INTO public.family_members (user_id, name, relationship, pan_masked, color_hex, is_primary, notes)
  VALUES (p_user_id, 'Kavitaben Sharma', 'parent', 'EFGHI5678K', '#f59e0b', false, 'Mother, age 61, Senior Citizen deposits & Sovereign Gold Bonds')
  RETURNING id INTO v_parent_id;

  -- 2. Portfolio Accounts (Demat & Bank Accounts)
  INSERT INTO public.portfolio_accounts (user_id, member_id, account_name, broker_name, depository, account_number_masked, account_type)
  VALUES (p_user_id, v_primary_id, 'Zerodha Primary', 'Zerodha', 'CDSL', '****1024', 'demat')
  RETURNING id INTO v_zerodha_acc_id;

  INSERT INTO public.portfolio_accounts (user_id, member_id, account_name, broker_name, depository, account_number_masked, account_type)
  VALUES (p_user_id, v_spouse_id, 'Groww MF Direct', 'Groww', 'CDSL', '****4589', 'demat')
  RETURNING id INTO v_groww_acc_id;

  INSERT INTO public.portfolio_accounts (user_id, member_id, account_name, broker_name, depository, account_number_masked, account_type)
  VALUES (p_user_id, v_huf_id, 'HDFC Securities HUF', 'HDFC Securities', 'NSDL', '****9812', 'demat')
  RETURNING id INTO v_hdfc_sec_acc_id;

  INSERT INTO public.portfolio_accounts (user_id, member_id, account_name, broker_name, depository, account_number_masked, account_type)
  VALUES (p_user_id, v_spouse_id, 'SBI Staff Salary & Savings', 'State Bank of India', 'OTHER', '****3321', 'savings_bank')
  RETURNING id INTO v_bank_acc_id;

  INSERT INTO public.portfolio_accounts (user_id, member_id, account_name, broker_name, depository, account_number_masked, account_type)
  VALUES (p_user_id, v_parent_id, 'RBI Retail Direct SGB', 'RBI', 'RBI', '****7744', 'other')
  RETURNING id INTO v_sgb_acc_id;

  -- 3. Assets (Equities, MFs, Gold, FD)
  INSERT INTO public.assets (user_id, name, ticker, asset_class_id, currency, notes)
  VALUES (p_user_id, 'HDFC Bank Ltd', 'HDFCBANK.NS', 'equity', 'INR', 'Large-cap private sector bank')
  RETURNING id INTO v_asset_hdfc;

  INSERT INTO public.assets (user_id, name, ticker, asset_class_id, currency, notes)
  VALUES (p_user_id, 'Reliance Industries Ltd', 'RELIANCE.NS', 'equity', 'INR', 'Diversified energy & telecom conglomerate')
  RETURNING id INTO v_asset_reliance;

  INSERT INTO public.assets (user_id, name, ticker, asset_class_id, currency, notes)
  VALUES (p_user_id, 'Tata Consultancy Services', 'TCS.NS', 'equity', 'INR', 'IT services & consulting')
  RETURNING id INTO v_asset_tcs;

  INSERT INTO public.assets (user_id, name, ticker, asset_class_id, currency, notes)
  VALUES (p_user_id, 'Parag Parikh Flexi Cap Fund Direct-Growth', 'INF209KA12Z1', 'equity', 'INR', 'Core equity mutual fund holding')
  RETURNING id INTO v_asset_ppfc;

  INSERT INTO public.assets (user_id, name, ticker, asset_class_id, currency, notes)
  VALUES (p_user_id, 'Sovereign Gold Bond 2028-29 Series IV', 'SGB2829IV', 'commodity', 'INR', '2.5% semi-annual tax-free sovereign gold bond')
  RETURNING id INTO v_asset_sgb;

  INSERT INTO public.assets (user_id, name, ticker, asset_class_id, currency, notes)
  VALUES (p_user_id, 'State Bank Senior Citizen FD (7.5%)', 'FD-SBI-SR', 'fixed_income', 'INR', 'Quarterly compounding fixed deposit for Kavitaben')
  RETURNING id INTO v_asset_fd;

  -- 4. Holdings (Stored in integer paise: 1 INR = 100 paise)
  INSERT INTO public.holdings (user_id, asset_id, member_id, account_id, quantity, unit_cost_cents, current_value_cents)
  VALUES (p_user_id, v_asset_hdfc, v_primary_id, v_zerodha_acc_id, 100, 155000, 16800000);

  INSERT INTO public.holdings (user_id, asset_id, member_id, account_id, quantity, unit_cost_cents, current_value_cents)
  VALUES (p_user_id, v_asset_reliance, v_primary_id, v_zerodha_acc_id, 50, 280000, 15250000);

  INSERT INTO public.holdings (user_id, asset_id, member_id, account_id, quantity, unit_cost_cents, current_value_cents)
  VALUES (p_user_id, v_asset_tcs, v_huf_id, v_hdfc_sec_acc_id, 60, 340000, 24500000);

  INSERT INTO public.holdings (user_id, asset_id, member_id, account_id, quantity, unit_cost_cents, current_value_cents)
  VALUES (p_user_id, v_asset_ppfc, v_spouse_id, v_groww_acc_id, 2500, 6240, 21850000);

  INSERT INTO public.holdings (user_id, asset_id, member_id, account_id, quantity, unit_cost_cents, current_value_cents)
  VALUES (p_user_id, v_asset_sgb, v_parent_id, v_sgb_acc_id, 20, 540000, 15600000);

  INSERT INTO public.holdings (user_id, asset_id, member_id, account_id, quantity, unit_cost_cents, current_value_cents)
  VALUES (p_user_id, v_asset_fd, v_parent_id, v_bank_acc_id, 1, 50000000, 52800000);

  -- 5. Historical Transactions (Trade Ledger, Monthly SIPs, Dividends, LTCG/STCG)
  -- A. Initial Core Buy Transactions (2023 / 2024)
  INSERT INTO public.transactions (user_id, asset_id, member_id, account_id, type, quantity, amount_cents, currency, transaction_date, notes)
  VALUES 
    (p_user_id, v_asset_hdfc, v_primary_id, v_zerodha_acc_id, 'buy', 100, 15500000, 'INR', '2023-08-15 10:15:00+05:30', 'Bought 100 HDFC Bank shares @ ₹1,550'),
    (p_user_id, v_asset_reliance, v_primary_id, v_zerodha_acc_id, 'buy', 50, 14000000, 'INR', '2024-01-10 11:30:00+05:30', 'Bought 50 Reliance shares @ ₹2,800'),
    (p_user_id, v_asset_tcs, v_huf_id, v_hdfc_sec_acc_id, 'buy', 80, 27200000, 'INR', '2023-04-12 14:00:00+05:30', 'Bought 80 TCS shares @ ₹3,400 in HUF account'),
    (p_user_id, v_asset_sgb, v_parent_id, v_sgb_acc_id, 'buy', 20, 10800000, 'INR', '2023-06-20 12:00:00+05:30', 'RBI tranche subscription 20 units @ ₹5,400'),
    (p_user_id, v_asset_fd, v_parent_id, v_bank_acc_id, 'deposit', 1, 50000000, 'INR', '2024-01-01 10:00:00+05:30', 'Created 3-year Senior Citizen FD @ 7.5%');
  v_trade_count := v_trade_count + 5;

  -- B. Realized Tax Gain Trades (For Section 112A LTCG / STCG verification)
  -- Sold 20 TCS shares after 14 months (LTCG profit = ₹20,000, within ₹1,25,000 exemption limit)
  INSERT INTO public.transactions (user_id, asset_id, member_id, account_id, type, quantity, amount_cents, currency, transaction_date, notes)
  VALUES (p_user_id, v_asset_tcs, v_huf_id, v_hdfc_sec_acc_id, 'sell', 20, 8800000, 'INR', '2024-06-18 13:45:00+05:30', 'Tax Harvesting: Sold 20 TCS @ ₹4,400 (Cost: ₹3,400; LTCG: ₹20,000 exempt under 112A)');
  v_trade_count := v_trade_count + 1;

  -- C. Recurring Monthly SIP Cycles (Ananya compounding goal - 6 months of automated investments)
  INSERT INTO public.transactions (user_id, asset_id, member_id, account_id, type, quantity, amount_cents, currency, transaction_date, notes)
  VALUES
    (p_user_id, v_asset_ppfc, v_spouse_id, v_groww_acc_id, 'buy', 400, 2500000, 'INR', '2024-05-10 09:30:00+05:30', 'Monthly SIP: PPFC Direct-Growth (₹25,000)'),
    (p_user_id, v_asset_ppfc, v_spouse_id, v_groww_acc_id, 'buy', 410, 2500000, 'INR', '2024-06-10 09:30:00+05:30', 'Monthly SIP: PPFC Direct-Growth (₹25,000)'),
    (p_user_id, v_asset_ppfc, v_spouse_id, v_groww_acc_id, 'buy', 405, 2500000, 'INR', '2024-07-10 09:30:00+05:30', 'Monthly SIP: PPFC Direct-Growth (₹25,000)'),
    (p_user_id, v_asset_ppfc, v_spouse_id, v_groww_acc_id, 'buy', 420, 2500000, 'INR', '2024-08-10 09:30:00+05:30', 'Monthly SIP: PPFC Direct-Growth (₹25,000)'),
    (p_user_id, v_asset_ppfc, v_spouse_id, v_groww_acc_id, 'buy', 430, 2500000, 'INR', '2024-09-10 09:30:00+05:30', 'Monthly SIP: PPFC Direct-Growth (₹25,000)'),
    (p_user_id, v_asset_ppfc, v_spouse_id, v_groww_acc_id, 'buy', 435, 2500000, 'INR', '2024-10-10 09:30:00+05:30', 'Monthly SIP: PPFC Direct-Growth (₹25,000)');
  v_trade_count := v_trade_count + 6;

  -- D. Passive Cashflow (Dividends & Interest Payouts)
  INSERT INTO public.transactions (user_id, asset_id, member_id, account_id, type, quantity, amount_cents, currency, transaction_date, notes)
  VALUES
    (p_user_id, v_asset_tcs, v_huf_id, v_hdfc_sec_acc_id, 'dividend', 60, 168000, 'INR', '2024-07-25 00:00:00+05:30', 'TCS Final Dividend @ ₹28/share on 60 shares (₹1,680 credited)'),
    (p_user_id, v_asset_hdfc, v_primary_id, v_zerodha_acc_id, 'dividend', 100, 195000, 'INR', '2024-08-01 00:00:00+05:30', 'HDFC Bank Annual Dividend @ ₹19.50/share (₹1,950 credited)'),
    (p_user_id, v_asset_fd, v_parent_id, v_bank_acc_id, 'dividend', 1, 937500, 'INR', '2024-09-30 00:00:00+05:30', 'SBI FD Quarterly Interest Credit (₹9,375 credited)');
  v_trade_count := v_trade_count + 3;

  -- 6. Financial Goals
  INSERT INTO public.financial_goals (user_id, member_id, name, target_amount_cents, current_amount_cents, target_date, category, priority, notes)
  VALUES (
    p_user_id, 
    v_child_id, 
    'Ananya Higher Education & University Fund', 
    500000000, -- ₹50 Lakhs (500000000 paise)
    125000000, -- ₹12.5 Lakhs saved
    '2038-06-30', 
    'education', 
    'critical', 
    'Goal for international engineering or business degree. Monthly reverse SIP target: ₹22,500.'
  );

  INSERT INTO public.financial_goals (user_id, member_id, name, target_amount_cents, current_amount_cents, target_date, category, priority, notes)
  VALUES (
    p_user_id, 
    v_primary_id, 
    'Family Financial Freedom & Retirement Nest', 
    5000000000, -- ₹5 Crores (5000000000 paise)
    965000000,  -- ₹96.5 Lakhs accumulated
    '2046-03-31', 
    'retirement', 
    'high', 
    'Targeting 30x annual household expenses with 60:30:10 asset allocation.'
  );

  -- 7. Liabilities & Loan Payments
  INSERT INTO public.liabilities (user_id, member_id, name, liability_type, lender_name, principal_amount_cents, remaining_balance_cents, interest_rate, monthly_emi_cents, start_date, tenure_months, notes)
  VALUES (
    p_user_id,
    v_primary_id,
    'Primary Residence Home Loan',
    'home_loan',
    'HDFC Bank',
    450000000, -- ₹45 Lakhs
    382000000, -- ₹38.2 Lakhs remaining
    8.40,
    3876500,   -- ₹38,765 monthly EMI
    '2022-04-01',
    240,
    'Joint home loan with Pooja Sharma for Section 24(b) ₹2 Lakh interest deduction shield.'
  )
  RETURNING id INTO v_liability_home;

  -- 3 Recent EMI Amortization Payment Records
  INSERT INTO public.loan_payments (liability_id, user_id, payment_date, total_payment_cents, principal_cents, interest_cents, extra_payment_cents, notes)
  VALUES
    (v_liability_home, p_user_id, '2024-08-05', 3876500, 1198500, 2678000, 0, 'August 2024 Regular Monthly EMI'),
    (v_liability_home, p_user_id, '2024-09-05', 3876500, 1206900, 2669600, 0, 'September 2024 Regular Monthly EMI'),
    (v_liability_home, p_user_id, '2024-10-05', 8876500, 1215300, 2661200, 5000000, 'October 2024 EMI + ₹50,000 Diwali Principal Prepayment');

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Comprehensive Anonymized QA household dataset seeded successfully',
    'user_id', p_user_id,
    'entities_created', 5,
    'accounts_created', 5,
    'assets_created', 6,
    'holdings_created', 6,
    'transactions_created', v_trade_count,
    'goals_created', 2,
    'liabilities_created', 1,
    'loan_payments_created', 3
  );
END;
$$;

-- Alias for backwards compatibility with earlier scripts
CREATE OR REPLACE FUNCTION public.seed_qa_vaghela_household(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT public.seed_qa_primary_household(p_user_id);
$$;

-- ==============================================================================
-- 3. Secondary Seed: Multi-Tenant RLS Cross-User Isolation Persona
-- (Populates independent "Verma Household" so testers can verify User A cannot
--  see User B's portfolios, PAN cards, or Demat accounts under RLS).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.seed_qa_secondary_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id uuid;
  v_acc_id uuid;
  v_asset_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user_id cannot be null';
  END IF;

  -- Independent Member
  INSERT INTO public.family_members (user_id, name, relationship, pan_masked, color_hex, is_primary, notes)
  VALUES (p_user_id, 'Sanjay Verma', 'self', 'ZZZZZ9999X', '#10b981', true, 'Isolated Tenant 2 (Test RLS Cross-User Protection)')
  RETURNING id INTO v_member_id;

  -- Independent Demat
  INSERT INTO public.portfolio_accounts (user_id, member_id, account_name, broker_name, depository, account_number_masked, account_type)
  VALUES (p_user_id, v_member_id, 'Upstox Active Demat', 'Upstox', 'CDSL', '****8811', 'demat')
  RETURNING id INTO v_acc_id;

  -- Independent Asset & Holding
  INSERT INTO public.assets (user_id, name, ticker, asset_class_id, currency, notes)
  VALUES (p_user_id, 'Infosys Ltd', 'INFY.NS', 'equity', 'INR', 'Tenant 2 IT holding')
  RETURNING id INTO v_asset_id;

  INSERT INTO public.holdings (user_id, asset_id, member_id, account_id, quantity, unit_cost_cents, current_value_cents)
  VALUES (p_user_id, v_asset_id, v_member_id, v_acc_id, 150, 148000, 28200000);

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Secondary tenant test persona (Verma Household) seeded successfully',
    'user_id', p_user_id,
    'pan_masked', 'ZZZZZ9999X',
    'holding', 'Infosys Ltd (150 shares)'
  );
END;
$$;
