/**
 * Network input validation utilities for robot host address and port settings.
 */

/**
 * Validates whether a string is a valid IPv4 address (0.0.0.0 to 255.255.255.255).
 */
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return false

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false
    const num = Number(part)
    // Disallow leading zeros for multi-digit numbers (e.g. 01)
    if (part.length > 1 && part.startsWith('0')) return false
    return num >= 0 && num <= 255
  })
}

/**
 * Validates whether a string is a valid RFC 1123 hostname or mDNS local name (e.g. jetson.local).
 */
export function isValidHostname(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') return false
  const trimmed = hostname.trim()
  if (trimmed.length < 1 || trimmed.length > 253) return false

  // RFC 1123 label regex: alphanumeric with internal hyphens
  const labelRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/
  const parts = trimmed.split('.')
  return parts.every((label) => labelRegex.test(label))
}

/**
 * Validates whether a host string is either a valid IPv4 address or a valid hostname.
 */
export function isValidHost(host: string): boolean {
  return isValidIPv4(host) || isValidHostname(host)
}

/**
 * Validates whether a port number is within the valid TCP/UDP range (1 to 65535).
 */
export function isValidPort(port: number | string): boolean {
  const num = typeof port === 'string' ? Number(port) : port
  if (!Number.isInteger(num)) return false
  return num >= 1 && num <= 65535
}
