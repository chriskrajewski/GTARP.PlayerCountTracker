import { getAPICache } from './api-cache';

const GAME_ID_MEMORY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface TwitchGameIdCachePayload {
  gameId: string;
  originalName: string;
  lastUpdated: string;
}

const memoryCache = new Map<string, { id: string; expiresAt: number }>();

export async function getTwitchGameIds(
  clientId: string,
  token: string,
  gameNames: string[],
  options?: { bustCache?: boolean }
): Promise<Map<string, string>> {
  const cache = getAPICache();
  const now = Date.now();
  const resolved = new Map<string, string>();
  const uniqueNames = Array.from(
    new Set(
      gameNames
        .map(name => (name || '').trim())
        .filter(Boolean)
    )
  );

  const namesToFetch: string[] = [];

  for (const name of uniqueNames) {
    const lower = name.toLowerCase();
    const memoryEntry = memoryCache.get(lower);
    if (memoryEntry && memoryEntry.expiresAt > now) {
      resolved.set(name, memoryEntry.id);
      continue;
    }

    if (!options?.bustCache) {
      try {
        const cached = await cache.get<TwitchGameIdCachePayload>('twitch_game_ids', lower);
        if (cached?.gameId) {
          resolved.set(name, cached.gameId);
          memoryCache.set(lower, { id: cached.gameId, expiresAt: now + GAME_ID_MEMORY_TTL_MS });
          continue;
        }
      } catch (error) {
        console.warn('[TwitchGameIds] Shared cache lookup failed:', error);
      }
    }

    namesToFetch.push(name);
  }

  for (const name of namesToFetch) {
    const lower = name.toLowerCase();
    try {
      const response = await fetch(
        `https://api.twitch.tv/helix/games?name=${encodeURIComponent(name)}`,
        {
          headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`
          },
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!response.ok) {
        console.warn(`[TwitchGameIds] Failed to get game ID for "${name}": ${response.status}`);
        continue;
      }

      const data = await response.json();
      const gameId = data.data?.[0]?.id;
      if (!gameId) {
        console.warn(`[TwitchGameIds] Game not found on Twitch: "${name}"`);
        continue;
      }

      resolved.set(name, gameId);
      memoryCache.set(lower, { id: gameId, expiresAt: Date.now() + GAME_ID_MEMORY_TTL_MS });

      try {
        await cache.set('twitch_game_ids', lower, {
          gameId,
          originalName: name,
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.warn('[TwitchGameIds] Failed to cache game ID:', error);
      }
    } catch (error) {
      console.error(`[TwitchGameIds] Error getting game ID for "${name}":`, error);
    }
  }

  return resolved;
}
