import { GoalDetailDto } from '@wealthnest/application';

/**
 * Realistic pre-seeded Indian demo goals for unauthenticated visitors.
 */
export const DEMO_GOALS: GoalDetailDto[] = [
  {
    id: 'demo-g1',
    userId: 'demo-user',
    name: 'Emergency Reserve Fund (6 Months)',
    category: 'emergency_fund',
    targetAmountCents: 40000000, // ₹4,00,000
    targetDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 40000000, // ₹4,00,000 (100% funded)
    monthlyContributionCents: 0,
    expectedReturnRate: 6.5,
    inflationRate: 0,
    priority: 'critical',
    currency: 'INR',
    notes: 'Liquid fixed deposit and arbitrage fund reserves for unforeseen emergencies.',
    memberId: 'mem-self',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
  {
    id: 'demo-g2',
    userId: 'demo-user',
    name: 'Ketan & Parul Retirement (FIRE Target: 52)',
    category: 'retirement',
    targetAmountCents: 2500000000, // ₹2.50 Crore
    targetDate: new Date(Date.now() + 14 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 280000000, // ₹28 Lakh
    monthlyContributionCents: 4500000, // ₹45,000 / month
    expectedReturnRate: 12.0,
    inflationRate: 6.0,
    priority: 'critical',
    currency: 'INR',
    notes:
      'Ketan (Freelance Contractor, ex-MNC) & Parul (Bank of Baroda) long-term equity, PPF, and NPS accumulation.',
    memberId: 'mem-self',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
  {
    id: 'demo-g3',
    userId: 'demo-user',
    name: 'Family Home & Residence Reserve',
    category: 'home_purchase',
    targetAmountCents: 400000000, // ₹40 Lakh
    targetDate: new Date(Date.now() + 3.5 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 150000000, // ₹15 Lakh
    monthlyContributionCents: 4000000, // ₹40,000 / month
    expectedReturnRate: 10.0,
    inflationRate: 6.0,
    priority: 'high',
    currency: 'INR',
    notes: 'Corporate bonds and hybrid debt fund savings for family residence.',
    memberId: 'mem-spouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
  {
    id: 'demo-g4',
    userId: 'demo-user',
    name: 'Krisha Higher Education & University Corpus',
    category: 'education',
    targetAmountCents: 350000000, // ₹35 Lakh
    targetDate: new Date(Date.now() + 12 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 60000000, // ₹6 Lakh
    monthlyContributionCents: 1500000, // ₹15,000 / month
    expectedReturnRate: 11.5,
    inflationRate: 8.5,
    priority: 'high',
    currency: 'INR',
    notes:
      'Krisha Vaghela (Age 6, 1st Std) targeting university & professional degree corpus at age 18.',
    memberId: 'mem-child',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
  {
    id: 'demo-g5',
    userId: 'demo-user',
    name: 'Shamalbhai & Ramilaben Senior Healthcare & Pilgrimage Reserve',
    category: 'wealth_creation',
    targetAmountCents: 150000000, // ₹15 Lakh
    targetDate: new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 120000000, // ₹12 Lakh
    monthlyContributionCents: 1000000, // ₹10,000 / month
    expectedReturnRate: 7.5,
    inflationRate: 6.0,
    priority: 'high',
    currency: 'INR',
    notes: 'Shamalbhai (68) & Ramilaben (61) healthcare buffer and senior citizen pilgrimage fund.',
    memberId: 'mem-huf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
];

