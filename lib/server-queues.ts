export type QueueParserType = "chaseroleplay" | "free2rp" | "nopixel"

export interface ServerQueueConfig {
  serverId: string
  displayName: string
  apiUrl: string
  parser: QueueParserType
  /** For multi-server responses (e.g. NoPixel), which key under `data` to read. */
  dataKey?: string
  /** Min ms between background refreshes. Raise for rate-limited APIs. */
  minRefreshMs?: number
  /** How long an in-memory entry stays fresh. Raise for rate-limited APIs. */
  memoryTtlMs?: number
}

export interface QueueSegment {
  type: string
  label: string
  players: number
  cap?: number
}

export interface QueueServerData {
  totalPlayers: number
  segments: QueueSegment[]
}

const SERVER_QUEUE_CONFIGS: Record<string, ServerQueueConfig> = {
  "6j7je6": {
    serverId: "6j7je6",
    displayName: "ChaseRP",
    apiUrl: "https://chaseroleplay.com/api/queue/",
    parser: "chaseroleplay"
  },
  "ak44p9": {
    serverId: "ak44p9",
    displayName: "Free2RP",
    apiUrl: "https://free2rp.com/api/queue/info",
    parser: "free2rp"
  },
  // NoPixel (server_id "kekbkv" per server_xref). `dataKey` selects which server
  // to read from the multi-server response — "cc" is NoPixel's internal id for it.
  // play.nopixel.net is heavily rate limited, so refresh far less aggressively.
  "kekbkv": {
    serverId: "kekbkv",
    displayName: "NoPixel",
    apiUrl: "https://play.nopixel.net/api/servers/live",
    parser: "nopixel",
    dataKey: "cc",
    minRefreshMs: 120000, // 2 min between background refreshes
    memoryTtlMs: 120000   // serve in-memory data as fresh for 2 min
  }
}

export function getQueueConfig(serverId: string): ServerQueueConfig | null {
  return SERVER_QUEUE_CONFIGS[serverId] || null
}

export function hasQueueSupport(serverId: string): boolean {
  return serverId in SERVER_QUEUE_CONFIGS
}

export function getQueueEnabledServerIds(): string[] {
  return Object.keys(SERVER_QUEUE_CONFIGS)
}

export function filterQueueEnabledServers(serverIds: string[]): string[] {
  return serverIds.filter((id) => hasQueueSupport(id))
}
