import { Result, ok, err, isOk } from '@wealthnest/shared';
import {
  FamilyPortfolioSummary,
  calculateFamilyPortfolioSummary,
  HoldingFamilyItem,
} from '@wealthnest/domain';
import {
  FamilyRepositoryPort,
  FamilyMemberDto,
  PortfolioAccountDto,
} from '../ports/family-repository.port.js';
import { HoldingRepositoryPort, HoldingDetailDto } from '../ports/holding-repository.port.js';

export class GetFamilyPortfolioSummaryUseCase {
  constructor(
    private readonly familyRepo: FamilyRepositoryPort,
    private readonly holdingRepo: HoldingRepositoryPort
  ) {}

  async execute(userId: string): Promise<Result<FamilyPortfolioSummary>> {
    try {
      const membersResult = await this.familyRepo.getMembers(userId);
      if (!isOk(membersResult)) return err(membersResult.error);

      const accountsResult = await this.familyRepo.getAccounts(userId);
      if (!isOk(accountsResult)) return err(accountsResult.error);

      const holdingsResult = await this.holdingRepo.listDetailsByUser(userId);
      if (!isOk(holdingsResult)) return err(holdingsResult.error);

      const members = membersResult.value;
      const accounts = accountsResult.value;
      const holdings = holdingsResult.value;

      const domainHoldings: HoldingFamilyItem[] = holdings.map((h: HoldingDetailDto) => {
        const isLongTerm = true; // Default long-term or calculated from acquisition
        return {
          id: h.holdingId,
          memberId: h.memberId,
          accountId: h.accountId,
          currentValuePaise: BigInt(h.currentValueCents),
          costBasisPaise: BigInt(Math.round(h.quantity * h.unitCostCents)),
          holdingPeriodDays: isLongTerm ? 400 : 180,
          isEquityOrMutualFund: h.assetClassId === 'equity' || h.assetClassId === 'mutual_fund',
        };
      });

      const summary = calculateFamilyPortfolioSummary(members, accounts, domainHoldings);
      return ok(summary);
    } catch (e: any) {
      return err(new Error(e?.message || 'Error generating family portfolio summary'));
    }
  }
}

export class ManageFamilyMembersUseCase {
  constructor(private readonly familyRepo: FamilyRepositoryPort) {}

  async createMember(params: {
    userId: string;
    name: string;
    relationship: FamilyMemberDto['relationship'];
    panMasked?: string;
    colorHex?: string;
    isPrimary?: boolean;
    notes?: string;
  }): Promise<Result<FamilyMemberDto>> {
    try {
      if (!params.name.trim()) {
        return err(new Error('Member name cannot be empty'));
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mem-${Date.now()}`;
      const member: FamilyMemberDto = {
        id,
        userId: params.userId,
        name: params.name.trim(),
        relationship: params.relationship,
        panMasked: params.panMasked?.toUpperCase().trim(),
        colorHex: params.colorHex || '#3b82f6',
        isPrimary: !!params.isPrimary,
        notes: params.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await this.familyRepo.saveMember(member);
      if (!isOk(res)) return err(res.error);

      return ok(member);
    } catch (e: any) {
      return err(new Error(e?.message || 'Error creating family member'));
    }
  }

  async updateMember(member: FamilyMemberDto): Promise<Result<void>> {
    return this.familyRepo.saveMember({
      ...member,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteMember(memberId: string): Promise<Result<void>> {
    return this.familyRepo.deleteMember(memberId);
  }
}

export class ManagePortfolioAccountsUseCase {
  constructor(private readonly familyRepo: FamilyRepositoryPort) {}

  async createAccount(params: {
    userId: string;
    memberId: string;
    accountName: string;
    brokerName: string;
    depository?: PortfolioAccountDto['depository'];
    accountNumberMasked?: string;
    accountType?: PortfolioAccountDto['accountType'];
  }): Promise<Result<PortfolioAccountDto>> {
    try {
      if (!params.accountName.trim()) {
        return err(new Error('Account name cannot be empty'));
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `acc-${Date.now()}`;
      const account: PortfolioAccountDto = {
        id,
        userId: params.userId,
        memberId: params.memberId,
        accountName: params.accountName.trim(),
        brokerName: params.brokerName.trim(),
        depository: params.depository || 'CDSL',
        accountNumberMasked: params.accountNumberMasked,
        accountType: params.accountType || 'demat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await this.familyRepo.saveAccount(account);
      if (!isOk(res)) return err(res.error);

      return ok(account);
    } catch (e: any) {
      return err(new Error(e?.message || 'Error creating portfolio account'));
    }
  }

  async updateAccount(account: PortfolioAccountDto): Promise<Result<void>> {
    return this.familyRepo.saveAccount({
      ...account,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteAccount(accountId: string): Promise<Result<void>> {
    return this.familyRepo.deleteAccount(accountId);
  }
}
