import { Result, ok, err } from '@wealthnest/shared';
import {
  TransactionRepositoryPort,
  TransactionDetailDto,
  CreateTransactionParams,
} from '@wealthnest/application';
import { TransactionType } from '@wealthnest/domain';
import { supabase } from './client';

interface JoinedTransactionRow {
  id: string;
  user_id: string;
  asset_id: string | null;
  type: string;
  quantity: number | string | null;
  amount_cents: number | string;
  currency: string;
  transaction_date: string;
  notes: string | null;
  created_at: string;
  assets: {
    id: string;
    name: string;
    ticker: string | null;
  } | null;
}

export class SupabaseTransactionAdapter implements TransactionRepositoryPort {
  async listByUser(userId: string): Promise<Result<TransactionDetailDto[]>> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          user_id,
          asset_id,
          type,
          quantity,
          amount_cents,
          currency,
          transaction_date,
          notes,
          created_at,
          assets (
            id,
            name,
            ticker
          )
        `)
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false });

      if (error) {
        return err(new Error(error.message));
      }

      const rows = (data || []) as unknown as JoinedTransactionRow[];
      const mapped: TransactionDetailDto[] = rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        assetId: row.asset_id ?? undefined,
        assetName: row.assets?.name,
        assetTicker: row.assets?.ticker ?? undefined,
        type: row.type as TransactionType,
        quantity: row.quantity !== null ? Number(row.quantity) : undefined,
        amountCents: Number(row.amount_cents),
        currency: row.currency,
        transactionDate: row.transaction_date,
        notes: row.notes ?? undefined,
        createdAt: row.created_at,
      }));

      return ok(mapped);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async createTransaction(params: CreateTransactionParams): Promise<Result<TransactionDetailDto>> {
    try {
      const transactionDate = params.transactionDate || new Date().toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: params.userId,
          asset_id: params.assetId || null,
          type: params.type,
          quantity: params.quantity !== undefined ? params.quantity : null,
          amount_cents: params.amountCents,
          currency: params.currency || 'INR',
          transaction_date: transactionDate,
          notes: params.notes || null,
        })
        .select('id, created_at, transaction_date')
        .single();

      if (error) {
        return err(new Error(`Failed to record transaction: ${error.message}`));
      }

      // Fetch asset name/ticker if assetId was provided
      let assetName: string | undefined;
      let assetTicker: string | undefined;

      if (params.assetId) {
        const { data: assetData } = await supabase
          .from('assets')
          .select('name, ticker')
          .eq('id', params.assetId)
          .single();

        if (assetData) {
          assetName = assetData.name;
          assetTicker = assetData.ticker ?? undefined;
        }
      }

      const created: TransactionDetailDto = {
        id: data.id,
        userId: params.userId,
        assetId: params.assetId,
        assetName,
        assetTicker,
        type: params.type,
        quantity: params.quantity,
        amountCents: params.amountCents,
        currency: params.currency || 'INR',
        transactionDate: data.transaction_date,
        notes: params.notes,
        createdAt: data.created_at,
      };

      return ok(created);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteTransaction(transactionId: string, userId: string): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', userId);

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
