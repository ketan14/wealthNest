import { ok, err, Result } from '@wealthnest/shared';
import { AssetClassDefinition } from '@wealthnest/domain';
import { AssetClassRepositoryPort } from '@wealthnest/application';
import { supabase } from './client';

interface AssetClassRow {
  id: string;
  name: string;
  description: string | null;
  color_hex: string;
  display_order: number;
}

export class SupabaseAssetClassAdapter implements AssetClassRepositoryPort {
  async listAll(): Promise<Result<AssetClassDefinition[]>> {
    try {
      const { data, error } = await supabase
        .from('asset_classes')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        return err(new Error(error.message));
      }

      const rows = (data || []) as AssetClassRow[];
      const mapped: AssetClassDefinition[] = rows.map((row: AssetClassRow) => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        colorHex: row.color_hex,
        displayOrder: row.display_order,
      }));

      return ok(mapped);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
