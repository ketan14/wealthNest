import { Result } from '@wealthnest/shared';
import {
  FamilyRelationship,
  DepositoryType,
  AccountType,
  FamilyEntityType,
  RecordVisibility,
} from '@wealthnest/domain';

export interface FamilyMemberDto {
  readonly id: string;
  readonly householdId?: string;
  readonly userId: string;
  readonly linkedUserId?: string;
  readonly email?: string;
  readonly entityType?: FamilyEntityType;
  readonly name: string;
  readonly relationship: FamilyRelationship;
  readonly panMasked?: string;
  readonly colorHex: string;
  readonly isPrimary: boolean;
  readonly notes?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface PortfolioAccountDto {
  readonly id: string;
  readonly householdId?: string;
  readonly userId: string;
  readonly memberId: string;
  readonly visibility?: RecordVisibility;
  readonly createdBy?: string;
  readonly accountName: string;
  readonly brokerName: string;
  readonly depository: DepositoryType;
  readonly accountNumberMasked?: string;
  readonly accountType: AccountType;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface FamilyRepositoryPort {
  getMembers(scopeId: string): Promise<Result<readonly FamilyMemberDto[]>>;
  getMembersByHousehold?(householdId: string): Promise<Result<readonly FamilyMemberDto[]>>;
  getMemberById(id: string): Promise<Result<FamilyMemberDto | null>>;
  saveMember(member: FamilyMemberDto): Promise<Result<void>>;
  deleteMember(id: string): Promise<Result<void>>;

  getAccounts(scopeId: string): Promise<Result<readonly PortfolioAccountDto[]>>;
  getAccountsByHousehold?(householdId: string): Promise<Result<readonly PortfolioAccountDto[]>>;
  getAccountById(id: string): Promise<Result<PortfolioAccountDto | null>>;
  saveAccount(account: PortfolioAccountDto): Promise<Result<void>>;
  deleteAccount(id: string): Promise<Result<void>>;
}
