import { LiabilityDto } from '@wealthnest/application';

export const DEMO_LIABILITIES: LiabilityDto[] = [
  {
    id: 'demo-loan-1',
    userId: 'demo-user',
    name: 'SBI Green Home Loan',
    loanType: 'home_loan',
    lender: 'State Bank of India',
    accountNumber: '38192004812',
    originalPrincipalCents: 500000000n, // ₹50,00,000 (50L)
    currentBalanceCents: 412500000n, // ₹41,25,000 (41.25L)
    interestRate: 8.5,
    interestType: 'floating',
    tenureMonths: 240,
    emiAmountCents: 4339100n, // ₹43,391/mo
    currency: 'INR',
    startDate: '2023-01-15',
    endDate: '2043-01-15',
    status: 'active',
    linkedAssetId: 'asset-home-1',
    linkedAssetName: '3BHK Apartment - Bengaluru',
    notes: 'Pegged to EBLR repo rate',
    memberId: 'mem-self',
    coBorrowerMemberIds: ['mem-spouse'],
    lastBalanceDate: '2026-01-10',
    createdAt: '2023-01-15T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'demo-loan-2',
    userId: 'demo-user',
    name: 'HDFC EV Auto Loan',
    loanType: 'vehicle_loan',
    lender: 'HDFC Bank',
    accountNumber: '89102938129',
    originalPrincipalCents: 150000000n, // ₹15,00,000 (15L)
    currentBalanceCents: 85000000n, // ₹8,50,000 (8.5L)
    interestRate: 7.9,
    interestType: 'fixed',
    tenureMonths: 60,
    emiAmountCents: 3034000n, // ₹30,340/mo
    currency: 'INR',
    startDate: '2024-03-01',
    endDate: '2029-03-01',
    status: 'active',
    notes: 'Electric Vehicle concessional green loan',
    memberId: 'mem-spouse',
    coBorrowerMemberIds: [],
    lastBalanceDate: '2026-01-05',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
  },
];

