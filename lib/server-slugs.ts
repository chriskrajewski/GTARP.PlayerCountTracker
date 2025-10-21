export type ServerIdentifier = {
  server_id: string
  server_name: string
}

export type ServerSlugMaps = {
  idToSlug: Record<string, string>
  slugToId: Map<string, string>
}

export const DEFAULT_SERVER_TOKEN = "srv"

export function sanitizeServerToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

export function slugifyServerName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function serverInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return ""

  return parts.map((part) => part[0].toLowerCase()).join("")
}

export function buildServerSlugMaps(servers: ServerIdentifier[]): ServerSlugMaps {
  const slugToId = new Map<string, string>()
  const idToSlug: Record<string, string> = {}
  const slugCounts = new Map<string, number>()

  servers.forEach((server) => {
    let baseSlug = slugifyServerName(server.server_name)
    if (!baseSlug) {
      baseSlug = server.server_id.toLowerCase()
    }

    const usage = slugCounts.get(baseSlug) ?? 0
    slugCounts.set(baseSlug, usage + 1)

    const finalSlug = usage > 0 ? `${baseSlug}-${usage + 1}` : baseSlug
    const slugKey = finalSlug.toLowerCase()

    slugToId.set(slugKey, server.server_id)
    idToSlug[server.server_id] = finalSlug

    slugToId.set(server.server_id.toLowerCase(), server.server_id)

    const initials = serverInitials(server.server_name)
    if (initials && !slugToId.has(initials)) {
      slugToId.set(initials, server.server_id)
    }
  })

  return { idToSlug, slugToId }
}

export type ServerSlugInfo = {
  slug: string
  sanitized: string
}

export function buildSlugLookup(servers: ServerIdentifier[], slugMaps: ServerSlugMaps): Record<string, ServerSlugInfo> {
  return servers.reduce<Record<string, ServerSlugInfo>>((acc, server) => {
    const slug = (slugMaps.idToSlug[server.server_id] ?? server.server_id).toLowerCase()
    const sanitized = sanitizeServerToken(slug) || sanitizeServerToken(server.server_id)

    acc[server.server_id] = {
      slug,
      sanitized: sanitized || DEFAULT_SERVER_TOKEN,
    }

    return acc
  }, {})
}

export function buildServerPrefixes(
  servers: ServerIdentifier[],
  slugLookup: Record<string, ServerSlugInfo>,
): Record<string, string> {
  if (servers.length === 0) return {}

  const sanitizedEntries = servers.map((server) => ({
    id: server.server_id,
    sanitized:
      slugLookup[server.server_id]?.sanitized ??
      (sanitizeServerToken(server.server_id) || DEFAULT_SERVER_TOKEN),
  }))

  const prefixes: Record<string, string> = {}

  sanitizedEntries.forEach(({ id, sanitized }) => {
    let prefixLength = Math.min(Math.max(2, sanitized.length >= 2 ? 3 : sanitized.length), sanitized.length)
    if (prefixLength === 0) {
      prefixes[id] = DEFAULT_SERVER_TOKEN
      return
    }

    let prefix = sanitized.slice(0, prefixLength)

    for (let length = prefixLength; length <= sanitized.length; length++) {
      const candidate = sanitized.slice(0, length)
      const conflict = sanitizedEntries.some(
        (other) => other.id !== id && (other.sanitized.startsWith(candidate) || other.sanitized === candidate),
      )

      if (!conflict || length === sanitized.length) {
        prefix = candidate
        break
      }
    }

    prefixes[id] = prefix
  })

  return prefixes
}

export function resolveServerTokens(
  tokens: string[],
  slugMaps: ServerSlugMaps,
  servers: ServerIdentifier[],
  slugLookup: Record<string, ServerSlugInfo>,
): string[] {
  const resolved: string[] = []

  tokens.forEach((token) => {
    const normalized = token.toLowerCase()
    const sanitizedToken = sanitizeServerToken(normalized)

    const mapped = slugMaps.slugToId.get(normalized)
    if (mapped && !resolved.includes(mapped)) {
      resolved.push(mapped)
      return
    }

    const match = servers.find((server) => {
      const info = slugLookup[server.server_id]
      const slug = info?.slug ?? server.server_id.toLowerCase()
      const sanitizedSlug = info?.sanitized ?? sanitizeServerToken(server.server_id)

      return (
        server.server_id.toLowerCase() === normalized ||
        slug === normalized ||
        slugifyServerName(server.server_name) === normalized ||
        sanitizedSlug === sanitizedToken ||
        (sanitizedToken.length > 0 && sanitizedSlug.startsWith(sanitizedToken))
      )
    })

    if (match && !resolved.includes(match.server_id)) {
      resolved.push(match.server_id)
    }
  })

  return resolved
}

export function encodeServerTokens(serverIds: string[], prefixes: Record<string, string>): string {
  return serverIds
    .map((id) => prefixes[id] ?? (sanitizeServerToken(id).slice(0, 3) || DEFAULT_SERVER_TOKEN))
    .join("-")
}

export function decodeServerTokenString(value: string): string[] {
  return value
    .split(/[-+]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}
