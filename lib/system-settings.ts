import { createServiceRoleClient } from './supabase-service-role';
import type { Database } from './supabase.types';

export type SystemSettingRecord = Database['public']['Tables']['system_settings']['Row'];

const SETTINGS_CACHE_TTL_MS = 60 * 1000;
const settingsCache = new Map<string, { record: SystemSettingRecord; expiresAt: number }>();

const DEFAULT_TWITCH_STREAM_PAGE_LIMIT = (() => {
  const fallback = 35;
  const raw = Number(process.env.TWITCH_STREAM_PAGE_LIMIT);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.min(raw, 75);
  }
  return fallback;
})();

type SettingValue = string | number | boolean | Record<string, unknown> | null;
type SettingDataType = 'string' | 'number' | 'boolean' | 'json';

interface GetSettingOptions {
  bustCache?: boolean;
}

interface NumericSettingOptions extends GetSettingOptions {
  min?: number;
  max?: number;
}

interface UpsertSettingInput {
  key: string;
  value: SettingValue;
  data_type?: SettingDataType;
  description?: string | null;
  category?: string | null;
  updated_by?: string | null;
}

function serializeSettingValue(value: SettingValue, dataType: SettingDataType): string {
  if (dataType === 'json') {
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return 'null';
    }
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function inferDataType(value: SettingValue, explicit?: SettingDataType): SettingDataType {
  if (explicit) return explicit;
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'json';
  return 'string';
}

function clampNumber(value: number, min?: number, max?: number) {
  let result = value;
  if (typeof min === 'number') {
    result = Math.max(min, result);
  }
  if (typeof max === 'number') {
    result = Math.min(max, result);
  }
  return result;
}

export async function getSystemSettingRecord(key: string, options?: GetSettingOptions): Promise<SystemSettingRecord | null> {
  const now = Date.now();

  if (!options?.bustCache) {
    const cached = settingsCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.record;
    }
  } else {
    settingsCache.delete(key);
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', key)
      .limit(1);

    if (error) {
      console.error(`[SystemSettings] Failed to fetch setting "${key}":`, error);
      return null;
    }

    const record = data?.[0] ?? null;
    if (record) {
      settingsCache.set(key, { record, expiresAt: now + SETTINGS_CACHE_TTL_MS });
    } else {
      settingsCache.delete(key);
    }

    return record;
  } catch (error) {
    console.error(`[SystemSettings] Error fetching setting "${key}":`, error);
    return null;
  }
}

export async function listSystemSettings(category?: string): Promise<SystemSettingRecord[]> {
  try {
    const supabase = createServiceRoleClient();
    let query = supabase
      .from('system_settings')
      .select('*');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('key', { ascending: true });

    if (error) {
      console.error('[SystemSettings] Failed to list settings:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[SystemSettings] Error listing settings:', error);
    return [];
  }
}

export async function upsertSystemSetting(input: UpsertSettingInput): Promise<SystemSettingRecord | null> {
  try {
    const supabase = createServiceRoleClient();
    const dataType = inferDataType(input.value, input.data_type);
    const serializedValue = serializeSettingValue(input.value, dataType);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: input.key,
          value: serializedValue,
          data_type: dataType,
          description: input.description ?? null,
          category: input.category ?? null,
          updated_at: now,
          updated_by: input.updated_by ?? 'admin_portal',
        },
        { onConflict: 'key' }
      )
      .select('*')
      .single();

    if (error) {
      console.error(`[SystemSettings] Failed to upsert setting "${input.key}":`, error);
      return null;
    }

    settingsCache.set(input.key, { record: data, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS });
    return data;
  } catch (error) {
    console.error(`[SystemSettings] Error upserting setting "${input.key}":`, error);
    return null;
  }
}

export async function getNumericSystemSetting(
  key: string,
  fallback: number,
  options?: NumericSettingOptions
): Promise<number> {
  const record = await getSystemSettingRecord(key, options);
  if (!record) return fallback;

  const parsed = Number(record.value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return clampNumber(parsed, options?.min, options?.max);
}

export async function getTwitchStreamPageLimit(options?: GetSettingOptions): Promise<number> {
  return getNumericSystemSetting('twitch_stream_page_limit', DEFAULT_TWITCH_STREAM_PAGE_LIMIT, {
    min: 1,
    max: 75,
    bustCache: options?.bustCache,
  });
}

export { DEFAULT_TWITCH_STREAM_PAGE_LIMIT };
