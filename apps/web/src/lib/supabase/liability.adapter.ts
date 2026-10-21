import { Result, ok, err } from '@wealthnest/shared';
import {
  LiabilityRepositoryPort,
  LiabilityDto,
  LiabilityBalanceDto,
  AssetValuationDto,
  AssetLiabilityLinkDto,
  CreateLiabilityParams,
  UpdateLiabilityParams,
  RecordLiabilityBalanceParams,
  RecordAssetValuationParams,
} from '@wealthnest/application';
import { supabase } from './client';

interface JoinedLiabilityRow {
  id: string;
  user_id: string;
  name: string;
  loan_type: string;
  lender: string;
  account_number: string | null;
  original_principal_cents: string | number;
  interest_rate: string | number;
  interest_type: string;
  tenure_months: number | null;
  emi_amount_cents: string | number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  linked_asset_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assets: {
    id: string;
    name: string;
  } | null;
}

export class SupabaseLiabilityAdapter implements LiabilityRepositoryPort {
  async listLiabilitiesByUser(userId: string): Promise<Result<readonly LiabilityDto[]>> {
    try {
      const { data, error } = await supabase
        .from('liabilities')
        .select(
          `
          id,
          user_id,
          name,
          loan_type,
          lender,
          account_number,
          original_principal_cents,
          interest_rate,
          interest_type,
          tenure_months,
          emi_amount_cents,
          currency,
          start_date,
          end_date,
          status,
          linked_asset_id,
          notes,
          created_at,
          updated_at,
          assets (
            id,
            name
          )
        `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return err(new Error(`Failed to list liabilities: ${error.message}`));
      }

      const rows = (data || []) as unknown as JoinedLiabilityRow[];

      // Fetch latest balances for all user liabilities
      const { data: balanceData } = await supabase
        .from('liability_balances')
        .select('liability_id, balance_cents, as_of_date')
        .eq('user_id', userId)
        .order('as_of_date', { ascending: false });

      const latestBalanceMap = new Map<string, { balanceCents: bigint; asOfDate: string }>();
      if (balanceData) {
        for (const b of balanceData) {
          if (!latestBalanceMap.has(b.liability_id)) {
            latestBalanceMap.set(b.liability_id, {
              balanceCents: BigInt(Math.round(Number(b.balance_cents) || 0)),
              asOfDate: b.as_of_date,
            });
          }
        }
      }

      const result: LiabilityDto[] = rows.map((r) => {
        const origPrincipal = BigInt(Math.round(Number(r.original_principal_cents) || 0));
        const latestBal = latestBalanceMap.get(r.id);
        const currentBalance = latestBal ? latestBal.balanceCents : origPrincipal;

        return {
          id: r.id,
          userId: r.user_id,
          name: r.name,
          loanType: r.loan_type as any,
          lender: r.lender,
          accountNumber: r.account_number || undefined,
          originalPrincipalCents: origPrincipal,
          currentBalanceCents: currentBalance,
          interestRate: Number(r.interest_rate) || 0,
          interestType: (r.interest_type as any) || 'floating',
          tenureMonths: r.tenure_months || undefined,
          emiAmountCents: BigInt(Math.round(Number(r.emi_amount_cents) || 0)),
          currency: r.currency || 'INR',
          startDate: r.start_date || undefined,
          endDate: r.end_date || undefined,
          status: (r.status as any) || 'active',
          linkedAssetId: r.linked_asset_id || undefined,
          linkedAssetName: r.assets?.name || undefined,
          notes: r.notes || undefined,
          lastBalanceDate: latestBal?.asOfDate,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });

      return ok(result);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getLiabilityById(id: string, userId: string): Promise<Result<LiabilityDto | null>> {
    try {
      const { data, error } = await supabase
        .from('liabilities')
        .select(
          `
          id,
          user_id,
          name,
          loan_type,
          lender,
          account_number,
          original_principal_cents,
          interest_rate,
          interest_type,
          tenure_months,
          emi_amount_cents,
          currency,
          start_date,
          end_date,
          status,
          linked_asset_id,
          notes,
          created_at,
          updated_at,
          assets (
            id,
            name
          )
        `
        )
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return err(new Error(`Failed to get liability: ${error.message}`));
      }
      if (!data) {
        return ok(null);
      }

      const r = data as unknown as JoinedLiabilityRow;
      const origPrincipal = BigInt(Math.round(Number(r.original_principal_cents) || 0));

      const { data: latestBalRow } = await supabase
        .from('liability_balances')
        .select('balance_cents, as_of_date')
        .eq('liability_id', id)
        .order('as_of_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = latestBalRow
        ? BigInt(Math.round(Number(latestBalRow.balance_cents) || 0))
        : origPrincipal;

      return ok({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        loanType: r.loan_type as any,
        lender: r.lender,
        accountNumber: r.account_number || undefined,
        originalPrincipalCents: origPrincipal,
        currentBalanceCents: currentBalance,
        interestRate: Number(r.interest_rate) || 0,
        interestType: (r.interest_type as any) || 'floating',
        tenureMonths: r.tenure_months || undefined,
        emiAmountCents: BigInt(Math.round(Number(r.emi_amount_cents) || 0)),
        currency: r.currency || 'INR',
        startDate: r.start_date || undefined,
        endDate: r.end_date || undefined,
        status: (r.status as any) || 'active',
        linkedAssetId: r.linked_asset_id || undefined,
        linkedAssetName: r.assets?.name || undefined,
        notes: r.notes || undefined,
        lastBalanceDate: latestBalRow?.asOf_date,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async createLiability(params: CreateLiabilityParams): Promise<Result<LiabilityDto>> {
    try {
      const { data, error } = await supabase
        .from('liabilities')
        .insert({
          user_id: params.userId,
          name: params.name,
          loan_type: params.loanType,
          lender: params.lender,
          account_number: params.accountNumber || null,
          original_principal_cents: Number(params.originalPrincipalCents),
          interest_rate: params.interestRate,
          interest_type: params.interestType || 'floating',
          tenure_months: params.tenureMonths || null,
          emi_amount_cents: Number(params.emiAmountCents || 0n),
          currency: params.currency || 'INR',
          start_date: params.startDate || null,
          end_date: params.endDate || null,
          status: params.status || 'active',
          linked_asset_id: params.linkedAssetId || null,
          notes: params.notes || null,
        })
        .select()
        .single();

      if (error || !data) {
        return err(new Error(`Failed to create liability: ${error?.message || 'Unknown error'}`));
      }

      return ok({
        id: data.id,
        userId: data.user_id,
        name: data.name,
        loanType: data.loan_type as any,
        lender: data.lender,
        accountNumber: data.account_number || undefined,
        originalPrincipalCents: BigInt(Math.round(Number(data.original_principal_cents))),
        currentBalanceCents: BigInt(
          Math.round(Number(params.initialBalanceCents ?? data.original_principal_cents))
        ),
        interestRate: Number(data.interest_rate),
        interestType: data.interest_type as any,
        tenureMonths: data.tenure_months || undefined,
        emiAmountCents: BigInt(Math.round(Number(data.emi_amount_cents))),
        currency: data.currency,
        startDate: data.start_date || undefined,
        endDate: data.end_date || undefined,
        status: data.status as any,
        linkedAssetId: data.linked_asset_id || undefined,
        notes: data.notes || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async updateLiability(params: UpdateLiabilityParams): Promise<Result<LiabilityDto>> {
    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (params.name !== undefined) updateData.name = params.name;
      if (params.loanType !== undefined) updateData.loan_type = params.loanType;
      if (params.lender !== undefined) updateData.lender = params.lender;
      if (params.accountNumber !== undefined) updateData.account_number = params.accountNumber;
      if (params.interestRate !== undefined) updateData.interest_rate = params.interestRate;
      if (params.interestType !== undefined) updateData.interest_type = params.interestType;
      if (params.tenureMonths !== undefined) updateData.tenure_months = params.tenureMonths;
      if (params.emiAmountCents !== undefined)
        updateData.emi_amount_cents = Number(params.emiAmountCents);
      if (params.status !== undefined) updateData.status = params.status;
      if (params.linkedAssetId !== undefined) updateData.linked_asset_id = params.linkedAssetId;
      if (params.notes !== undefined) updateData.notes = params.notes;

      const { data, error } = await supabase
        .from('liabilities')
        .update(updateData)
        .eq('id', params.id)
        .eq('user_id', params.userId)
        .select()
        .single();

      if (error || !data) {
        return err(new Error(`Failed to update liability: ${error?.message || 'Unknown error'}`));
      }

      return this.getLiabilityById(data.id, params.userId) as Promise<Result<LiabilityDto>>;
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteLiability(id: string, userId: string): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('liabilities')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        return err(new Error(`Failed to delete liability: ${error.message}`));
      }
      return ok(undefined);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async recordLiabilityBalance(
    params: RecordLiabilityBalanceParams
  ): Promise<Result<LiabilityBalanceDto>> {
    try {
      const { data, error } = await supabase
        .from('liability_balances')
        .upsert(
          {
            liability_id: params.liabilityId,
            user_id: params.userId,
            balance_cents: Number(params.balanceCents),
            as_of_date: params.asOfDate,
            source: params.source || 'manual',
            notes: params.notes || null,
          },
          { onConflict: 'liability_id, as_of_date' }
        )
        .select()
        .single();

      if (error || !data) {
        return err(
          new Error(`Failed to record liability balance: ${error?.message || 'Unknown error'}`)
        );
      }

      return ok({
        id: data.id,
        liabilityId: data.liability_id,
        userId: data.user_id,
        balanceCents: BigInt(Math.round(Number(data.balance_cents))),
        asOfDate: data.as_of_date,
        source: data.source,
        notes: data.notes || undefined,
        createdAt: data.created_at,
      });
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listLiabilityBalances(
    liabilityId: string,
    userId: string
  ): Promise<Result<readonly LiabilityBalanceDto[]>> {
    try {
      const { data, error } = await supabase
        .from('liability_balances')
        .select('*')
        .eq('liability_id', liabilityId)
        .eq('user_id', userId)
        .order('as_of_date', { ascending: false });

      if (error) {
        return err(new Error(`Failed to list liability balances: ${error.message}`));
      }

      const balances: LiabilityBalanceDto[] = (data || []).map((b) => ({
        id: b.id,
        liabilityId: b.liability_id,
        userId: b.user_id,
        balanceCents: BigInt(Math.round(Number(b.balance_cents))),
        asOfDate: b.as_of_date,
        source: b.source,
        notes: b.notes || undefined,
        createdAt: b.created_at,
      }));

      return ok(balances);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async recordAssetValuation(
    params: RecordAssetValuationParams
  ): Promise<Result<AssetValuationDto>> {
    try {
      const { data, error } = await supabase
        .from('asset_valuations')
        .upsert(
          {
            asset_id: params.assetId,
            user_id: params.userId,
            valuation_cents: Number(params.valuationCents),
            currency: params.currency || 'INR',
            as_of_date: params.asOfDate,
            source: params.source || 'manual_appraisal',
            notes: params.notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id, asset_id, as_of_date' }
        )
        .select()
        .single();

      if (error || !data) {
        return err(
          new Error(`Failed to record asset valuation: ${error?.message || 'Unknown error'}`)
        );
      }

      // Also update holdings current_value_cents if this valuation is current/latest
      await supabase
        .from('holdings')
        .update({
          current_value_cents: Number(params.valuationCents),
          updated_at: new Date().toISOString(),
        })
        .eq('asset_id', params.assetId)
        .eq('user_id', params.userId);

      return ok({
        id: data.id,
        assetId: data.asset_id,
        userId: data.user_id,
        valuationCents: BigInt(Math.round(Number(data.valuation_cents))),
        currency: data.currency,
        asOfDate: data.as_of_date,
        source: data.source,
        notes: data.notes || undefined,
        createdAt: data.created_at,
      });
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listAssetValuations(
    assetId: string,
    userId: string
  ): Promise<Result<readonly AssetValuationDto[]>> {
    try {
      const { data, error } = await supabase
        .from('asset_valuations')
        .select('*')
        .eq('asset_id', assetId)
        .eq('user_id', userId)
        .order('as_of_date', { ascending: false });

      if (error) {
        return err(new Error(`Failed to list asset valuations: ${error.message}`));
      }

      const valuations: AssetValuationDto[] = (data || []).map((v) => ({
        id: v.id,
        assetId: v.asset_id,
        userId: v.user_id,
        valuationCents: BigInt(Math.round(Number(v.valuation_cents))),
        currency: v.currency,
        asOfDate: v.as_of_date,
        source: v.source,
        notes: v.notes || undefined,
        createdAt: v.created_at,
      }));

      return ok(valuations);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listAssetLiabilityLinks(userId: string): Promise<Result<readonly AssetLiabilityLinkDto[]>> {
    try {
      const { data, error } = await supabase
        .from('asset_liability_links')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        return err(new Error(`Failed to list asset liability links: ${error.message}`));
      }

      const links: AssetLiabilityLinkDto[] = (data || []).map((l) => ({
        id: l.id,
        userId: l.user_id,
        assetId: l.asset_id,
        liabilityId: l.liability_id,
        linkType: l.link_type as any,
        ownershipSharePercentage: Number(l.ownership_share_percentage) || 100,
        createdAt: l.created_at,
      }));

      return ok(links);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async linkAssetLiability(params: {
    userId: string;
    assetId: string;
    liabilityId: string;
    linkType?: any;
    ownershipSharePercentage?: number;
  }): Promise<Result<void>> {
    try {
      const { error } = await supabase.from('asset_liability_links').upsert(
        {
          user_id: params.userId,
          asset_id: params.assetId,
          liability_id: params.liabilityId,
          link_type: params.linkType || 'mortgage',
          ownership_share_percentage: params.ownershipSharePercentage || 100,
        },
        { onConflict: 'asset_id, liability_id' }
      );

      if (error) {
        return err(new Error(`Failed to link asset and liability: ${error.message}`));
      }
      return ok(undefined);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async unlinkAssetLiability(
    userId: string,
    assetId: string,
    liabilityId: string
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('asset_liability_links')
        .delete()
        .eq('user_id', userId)
        .eq('asset_id', assetId)
        .eq('liability_id', liabilityId);

      if (error) {
        return err(new Error(`Failed to unlink asset and liability: ${error.message}`));
      }
      return ok(undefined);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
