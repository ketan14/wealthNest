import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Landmark,
  IndianRupee,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import {
  Money,
  PropertyType,
  RealEstatePropertyInput,
  summarizeRealEstatePortfolio,
} from '@wealthnest/domain';
import { HoldingDetailDto, LiabilityDto } from '@wealthnest/application';
import { useAuth } from '@/lib/supabase/auth-context';
import { useFamily } from '@/lib/family/family-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import {
  PropertyMetricsModal,
  PropertyMetricsOverride,
} from '@/components/real-estate/PropertyMetricsModal';
import { RealEstatePropertyList } from '@/components/real-estate/RealEstatePropertyList';

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
  const { members, selectedMemberId } = useFamily();
  const { holdingRepo, liabilityRepo } = useRepositories();
  const { isSupportModeActive } = useSupportSession();

  const effectiveUserId = user?.id || 'demo-user';

  const [baseProperties, setBaseProperties] = useState<RealEstatePropertyInput[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PropertyMetricsOverride>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<RealEstatePropertyInput | null>(null);

  const loadRealEstateData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setOverrides(loadOverrides(effectiveUserId));

    if (!user) {
      setBaseProperties(DEMO_PROPERTIES);
      setIsLoading(false);
      return;
    }

    const [holdingsRes, liabilitiesRes] = await Promise.all([
      holdingRepo.listDetailsByUser(user.id),
      liabilityRepo.listLiabilitiesByUser(user.id),
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

    const mapped: RealEstatePropertyInput[] = realEstateHoldings.map((h: HoldingDetailDto) => {
      const linkedLoans = activeLiabilities.filter((l) => l.linkedAssetId === h.assetId);
      const linkedLoanBalancePaise = linkedLoans.reduce(
        (acc, l) => acc + l.currentBalanceCents,
        0n
      );
      const linkedMonthlyEmiPaise = linkedLoans.reduce(
        (acc, l) => acc + l.emiAmountCents,
        0n
      );
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

    setBaseProperties(mapped);
    setIsLoading(false);
  }, [user, effectiveUserId, holdingRepo, liabilityRepo]);

  useEffect(() => {
    loadRealEstateData();
  }, [loadRealEstateData]);

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
    return mergedProperties.filter((p) => p.memberId === selectedMemberId);
  }, [mergedProperties, selectedMemberId]);

  const summary = useMemo(
    () => summarizeRealEstatePortfolio(memberFilteredProperties),
    [memberFilteredProperties]
  );

  const handleSaveOverride = (propertyId: string, override: PropertyMetricsOverride) => {
    const next = { ...overrides, [propertyId]: override };
    setOverrides(next);
    saveOverrides(effectiveUserId, next);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Real Estate Equity & Yield
            </h1>
            <p className="text-sm text-slate-400">
              Property valuations, linked home loan LTV, net equity, rental yield & cashflow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/liabilities">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Landmark className="w-4 h-4" />
              Home Loans
            </Button>
          </Link>
          <Link to="/documents">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Property Deeds
            </Button>
          </Link>
        </div>
      </div>

      {/* Family Filter Bar */}
      <FamilyFilterBar
        onOpenManageModal={() => setIsManageFamilyOpen(true)}
        showAccountSelector={false}
      />

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

      {/* Property Cards */}
      <RealEstatePropertyList
        isLoading={isLoading}
        properties={summary.properties}
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

      <ManageFamilyModal
        isOpen={isManageFamilyOpen}
        onClose={() => setIsManageFamilyOpen(false)}
      />
    </div>
  );
}
