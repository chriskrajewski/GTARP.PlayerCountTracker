export type QueueParserType = "chaseroleplay" | "free2rp"

export interface ServerQueueConfig {
  serverId: string
  displayName: string
  apiUrl: string
  parser: QueueParserType
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
