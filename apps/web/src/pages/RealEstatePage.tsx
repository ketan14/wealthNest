import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Landmark, IndianRupee, FileText, ShieldCheck, Plus } from 'lucide-react';
import {
  Money,
  PropertyType,
  RealEstatePropertyInput,
  summarizeRealEstatePortfolio,
} from '@wealthnest/domain';
import { HoldingDetailDto, LiabilityDto } from '@wealthnest/application';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useFamily } from '@/lib/family/family-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import {
  PropertyMetricsModal,
  PropertyMetricsOverride,
} from '@/components/real-estate/PropertyMetricsModal';
import { RealEstatePropertyList } from '@/components/real-estate/RealEstatePropertyList';
import { shouldAllowDemoData } from '@/lib/config/mobile-runtime';

const STORAGE_KEY_PREFIX = 'wealthnest_real_estate_overrides_v1_';

const DEMO_PROPERTIES: RealEstatePropertyInput[] = [
  {
    id: 'demo-re-1',
    name: '3BHK Apartment — Prahlad Nagar',
    propertyType: 'residential',
    location: 'Ahmedabad, Gujarat',
    memberId: 'mem-self',
    purchaseDate: '2019-06-15',
    purchasePricePaise: 58_00_000_00n, // ₹58.00L
    currentValuePaise: 92_50_000_00n, // ₹92.50L
    monthlyRentPaise: 26_000_00n, // ₹26,000/mo
    annualMaintenancePaise: 48_000_00n, // ₹48,000/yr
    propertyTaxPaise: 12_000_00n, // ₹12,000/yr
    linkedLoanBalancePaise: 41_20_000_00n, // ₹41.20L
    linkedMonthlyEmiPaise: 38_500_00n, // ₹38,500/mo
    linkedLoanName: 'HDFC Home Loan (8.50% p.a.)',
  },
  {
    id: 'demo-re-2',
    name: 'Commercial Shop — Satellite Road',
    propertyType: 'commercial',
    location: 'Ahmedabad, Gujarat',
    memberId: 'mem-huf',
    purchaseDate: '2018-03-10',
    purchasePricePaise: 42_00_000_00n, // ₹42.00L
    currentValuePaise: 64_00_000_00n, // ₹64.00L
    monthlyRentPaise: 34_000_00n, // ₹34,000/mo
    annualMaintenancePaise: 24_000_00n,
    propertyTaxPaise: 14_000_00n,
    linkedLoanBalancePaise: 0n,
    linkedMonthlyEmiPaise: 0n,
  },
  {
    id: 'demo-re-3',
    name: 'Embassy Office Parks REIT',
    propertyType: 'reit',
    location: 'NSE / Demat (Listed REIT)',
    memberId: 'mem-mother',
    purchaseDate: '2022-09-01',
    purchasePricePaise: 7_20_000_00n, // ₹7.20L
    currentValuePaise: 8_40_000_00n, // ₹8.40L
    monthlyRentPaise: 4_900_00n, // ₹4,900/mo eq distribution
    annualMaintenancePaise: 0n,
    propertyTaxPaise: 0n,
    linkedLoanBalancePaise: 0n,
    linkedMonthlyEmiPaise: 0n,
  },
];

function formatInr(paise: bigint): string {
  return Money.fromCents(paise, 'INR').format();
}

function getPropertyTypeLabel(type: PropertyType): string {
  switch (type) {
    case 'residential':
      return 'Residential';
    case 'commercial':
      return 'Commercial';
    case 'land':
      return 'Plot / Land';
    case 'reit':
      return 'Listed REIT';
  }
}

function inferPropertyType(holding: HoldingDetailDto): PropertyType {
  const lower = holding.name.toLowerCase();
  if (lower.includes('reit')) return 'reit';
  if (lower.includes('shop') || lower.includes('office') || lower.includes('commercial')) {
    return 'commercial';
  }
  if (lower.includes('plot') || lower.includes('land') || lower.includes('agri')) {
    return 'land';
  }
  return 'residential';
}

function loadOverrides(userId: string): Record<string, PropertyMetricsOverride> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        propertyType: PropertyType;
        location?: string;
        purchaseDate?: string;
        purchasePricePaise: string;
        monthlyRentPaise: string;
        annualMaintenancePaise: string;
        propertyTaxPaise: string;
      }
    >;
    const out: Record<string, PropertyMetricsOverride> = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = {
        propertyType: v.propertyType,
        location: v.location,
        purchaseDate: v.purchaseDate,
        purchasePricePaise: BigInt(v.purchasePricePaise || '0'),
        monthlyRentPaise: BigInt(v.monthlyRentPaise || '0'),
        annualMaintenancePaise: BigInt(v.annualMaintenancePaise || '0'),
        propertyTaxPaise: BigInt(v.propertyTaxPaise || '0'),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function saveOverrides(userId: string, overrides: Record<string, PropertyMetricsOverride>) {
  try {
    const serializable: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(overrides)) {
      serializable[k] = {
        ...v,
        purchasePricePaise: v.purchasePricePaise.toString(),
        monthlyRentPaise: v.monthlyRentPaise.toString(),
        annualMaintenancePaise: v.annualMaintenancePaise.toString(),
        propertyTaxPaise: v.propertyTaxPaise.toString(),
      };
    }
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(serializable));
  } catch {
    // ignore storage quota errors
  }
}

export function RealEstatePage() {
  const { user } = useAuth();
  const { activeHouseholdId, canEditFinancials } = useHousehold();
  const { members, selectedMemberId, setSelectedMemberId } = useFamily();
  const { holdingRepo, liabilityRepo, mode } = useRepositories();
  const { isSupportModeActive } = useSupportSession();

  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const scopeId = isDemoMode ? user?.id || 'demo-user' : activeHouseholdId || user?.id || '';
  const effectiveUserId = scopeId || 'demo-user';
  const [holdingOwnersMap, setHoldingOwnersMap] = useState<Record<string, string[]>>({});

  const [baseProperties, setBaseProperties] = useState<RealEstatePropertyInput[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PropertyMetricsOverride>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<RealEstatePropertyInput | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | PropertyType>('all');
  const [loanFilter, setLoanFilter] = useState<'all' | 'loan' | 'debt_free'>('all');

  const loadRealEstateData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setOverrides(loadOverrides(effectiveUserId));

    if (isDemoMode || !scopeId) {
      setBaseProperties(shouldAllowDemoData(isDemoMode) ? DEMO_PROPERTIES : []);
      setHoldingOwnersMap({});
      setIsLoading(false);
      return;
    }

    const [holdingsRes, liabilitiesRes] = await Promise.all([
      holdingRepo.listDetailsByHousehold
        ? holdingRepo.listDetailsByHousehold(scopeId)
        : holdingRepo.listDetailsByUser(scopeId),
      liabilityRepo.listLiabilitiesByHousehold
        ? liabilityRepo.listLiabilitiesByHousehold(scopeId)
        : liabilityRepo.listLiabilitiesByUser(scopeId),
    ]);

    if (!holdingsRes.success) {
      setErrorMessage(holdingsRes.error.message);
      setIsLoading(false);
      return;
    }

    const activeLiabilities: LiabilityDto[] = liabilitiesRes.success
      ? liabilitiesRes.value.filter((l: LiabilityDto) => l.status !== 'closed')
      : [];

    const realEstateHoldings = holdingsRes.value.filter(
      (h: HoldingDetailDto) => h.assetClassId === 'real_estate'
    );

    const ownersByHolding: Record<string, string[]> = {};
    for (const h of realEstateHoldings) {
      if (h.owners && h.owners.length > 0) {
        ownersByHolding[h.holdingId] = h.owners.map((o) => o.familyMemberId);
      }
    }

    const mapped: RealEstatePropertyInput[] = realEstateHoldings.map((h: HoldingDetailDto) => {
      const linkedLoans = activeLiabilities.filter((l) => l.linkedAssetId === h.assetId);
      const linkedLoanBalancePaise = linkedLoans.reduce(
        (acc, l) => acc + l.currentBalanceCents,
        0n
      );
      const linkedMonthlyEmiPaise = linkedLoans.reduce((acc, l) => acc + l.emiAmountCents, 0n);
      const purchasePricePaise = BigInt(
        Math.round((Number(h.quantity) || 1) * (Number(h.unitCostCents) || 0))
      );
      const currentValuePaise = BigInt(Math.round(Number(h.currentValueCents) || 0));

      return {
        id: h.holdingId,
        name: h.name,
        propertyType: inferPropertyType(h),
        memberId: h.memberId,
        purchasePricePaise,
        currentValuePaise,
        monthlyRentPaise: 0n,
        annualMaintenancePaise: 0n,
        propertyTaxPaise: 0n,
        linkedLoanBalancePaise,
        linkedMonthlyEmiPaise,
        linkedLoanName: linkedLoans.map((l) => l.name).join(', ') || undefined,
      };
    });

    setHoldingOwnersMap(ownersByHolding);
    setBaseProperties(mapped);
    setIsLoading(false);
  }, [isDemoMode, scopeId, holdingRepo, liabilityRepo]);

  useEffect(() => {
    loadRealEstateData();
  }, [loadRealEstateData]);

  useEffect(() => {
    setOverrides(loadOverrides(effectiveUserId));
  }, [effectiveUserId]);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.id, m.name);
    }
    return map;
  }, [members]);

  const mergedProperties = useMemo(() => {
    return baseProperties.map((prop) => {
      const ov = overrides[prop.id];
      if (!ov) return prop;
      return {
        ...prop,
        propertyType: ov.propertyType,
        location: ov.location ?? prop.location,
        purchaseDate: ov.purchaseDate ?? prop.purchaseDate,
        purchasePricePaise: ov.purchasePricePaise,
        monthlyRentPaise: ov.monthlyRentPaise,
        annualMaintenancePaise: ov.annualMaintenancePaise,
        propertyTaxPaise: ov.propertyTaxPaise,
      };
    });
  }, [baseProperties, overrides]);

  const memberFilteredProperties = useMemo(() => {
    if (!selectedMemberId || selectedMemberId.toLowerCase() === 'all') {
      return mergedProperties;
    }
    return mergedProperties.filter(
      (p) =>
        p.memberId === selectedMemberId || holdingOwnersMap[p.id]?.includes(selectedMemberId)
    );
  }, [mergedProperties, selectedMemberId, holdingOwnersMap]);

  const summary = useMemo(
    () => summarizeRealEstatePortfolio(memberFilteredProperties),
    [memberFilteredProperties]
  );

  const visibleProperties = useMemo(() => {
    return summary.properties.filter((metrics) => {
      if (typeFilter !== 'all' && metrics.input.propertyType !== typeFilter) return false;
      if (loanFilter === 'loan' && metrics.input.linkedLoanBalancePaise <= 0n) return false;
      if (loanFilter === 'debt_free' && metrics.input.linkedLoanBalancePaise > 0n) return false;
      return true;
    });
  }, [summary.properties, typeFilter, loanFilter]);

  const handleSaveOverride = (propertyId: string, override: PropertyMetricsOverride) => {
    if (!canEditFinancials || isSupportModeActive) return;
    const next = { ...overrides, [propertyId]: override };
    setOverrides(next);
    saveOverrides(effectiveUserId, next);
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-20 md:pb-8">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              Real Estate Equity & Yield
            </h1>
            <p className="hidden sm:block text-xs text-slate-400">
              Property valuations, linked home loan LTV, net equity &amp; rental cashflow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/liabilities">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 whitespace-nowrap shrink-0">
              <Landmark className="w-3.5 h-3.5" />
              Home Loans
            </Button>
          </Link>
          <Link to="/documents">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 whitespace-nowrap shrink-0">
              <FileText className="w-3.5 h-3.5" />
              Property Deeds
            </Button>
          </Link>
          <Link to="/portfolio?action=new">
            <Button
              size="sm"
              className="h-8 px-2.5 sm:px-3 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold whitespace-nowrap shrink-0 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Property
            </Button>
          </Link>
        </div>
      </div>

      {/* Compact Single-Row "MY FAMILY" Chip Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
          <span className="font-semibold uppercase tracking-wider text-slate-400 text-[11px]">
            My Family
          </span>
          <button
            type="button"
            onClick={() => setIsManageFamilyOpen(true)}
            className="text-[10px] text-primary hover:underline"
          >
            Manage
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedMemberId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              selectedMemberId === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
            }`}
          >
            All Members
          </button>

          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                selectedMemberId === m.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
              }`}
            >
              {m.name}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsManageFamilyOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary border border-border/60 whitespace-nowrap shrink-0"
          >
            <span>+ Manage</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Portfolio KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Property Value</span>
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">
              {formatInr(summary.totalPropertyValuePaise)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary.propertyCount} {summary.propertyCount === 1 ? 'property' : 'properties'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Net Property Equity</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">
              {formatInr(summary.totalNetEquityPaise)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Debt: {formatInr(summary.totalLinkedDebtPaise)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Weighted LTV Ratio</span>
              <Landmark className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">
              {summary.weightedLtvPct.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary.weightedLtvPct === 0
                ? '100% Debt-Free'
                : summary.weightedLtvPct <= 50
                  ? 'Healthy Leverage (≤ 50%)'
                  : 'Elevated Leverage'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Monthly Rental Income</span>
              <IndianRupee className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">
              {formatInr(summary.totalMonthlyRentPaise)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Gross {summary.averageGrossYieldPct.toFixed(2)}% · Net{' '}
              {summary.averageNetYieldPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fast Property Type & Loan Status Filter Strip */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
        <div className="flex items-center gap-1.5 shrink-0">
          {(
            [
              { id: 'all', label: 'All Types' },
              { id: 'residential', label: 'Residential' },
              { id: 'commercial', label: 'Commercial' },
              { id: 'land', label: 'Plot / Land' },
              { id: 'reit', label: 'Listed REIT' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTypeFilter(item.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                typeFilter === item.id
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'loan', label: 'With Loan' },
              { id: 'debt_free', label: 'Debt-Free' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLoanFilter(item.id)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                loanFilter === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Property Cards */}
      <RealEstatePropertyList
        isLoading={isLoading}
        properties={visibleProperties}
        memberNameMap={memberNameMap}
        isSupportModeActive={isSupportModeActive}
        formatInr={formatInr}
        getPropertyTypeLabel={getPropertyTypeLabel}
        onEditProperty={setEditingProperty}
      />

      {/* Modals */}
      <PropertyMetricsModal
        isOpen={Boolean(editingProperty)}
        property={editingProperty}
        onClose={() => setEditingProperty(null)}
        onSave={handleSaveOverride}
      />

      <ManageFamilyModal isOpen={isManageFamilyOpen} onClose={() => setIsManageFamilyOpen(false)} />
    </div>
  );
}
