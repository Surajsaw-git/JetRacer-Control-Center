/**
 * Network input validation and URL construction utilities for robot host address and port settings.
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

export interface ParsedAddressResult {
  valid: boolean
  error?: string
  warning?: string
  isLoopback: boolean
  isMixedContentRisk: boolean
  host: string
  rosbridgePort: number
  backendPort: number
  rosbridgeUrl: string
  backendUrl: string
}

/**
 * Determines whether the current execution environment is running over HTTPS.
 */
export function isHttpsContext(protocolOverride?: string): boolean {
  if (protocolOverride) {
    return protocolOverride === 'https:'
  }
  if (typeof window !== 'undefined' && window.location && window.location.protocol) {
    return window.location.protocol === 'https:'
  }
  return false
}

/**
 * Parses user input for robot connection (bare IPv4, hostname, or full URL).
 * Normalizes input, extracts host and ports, detects loopback/mixed content risks,
 * and derives valid Link A (rosbridge) and Link B (backend) endpoints.
 */
export function parseRobotAddress(
  rawInput: string,
  options?: {
    customRosbridgePort?: number
    customBackendPort?: number
    protocolOverride?: string
  },
): ParsedAddressResult {
  const trimmed = (rawInput || '').trim()

  const defaultResult: ParsedAddressResult = {
    valid: false,
    isLoopback: false,
    isMixedContentRisk: false,
    host: '',
    rosbridgePort: options?.customRosbridgePort || 9090,
    backendPort: options?.customBackendPort || 8000,
    rosbridgeUrl: '',
    backendUrl: '',
  }

  if (!trimmed) {
    return {
      ...defaultResult,
      error: 'Host address cannot be empty. Please enter the robot IP address or hostname.',
    }
  }

  // Strip trailing slashes and normalize
  let cleaned = trimmed.replace(/\/+$/, '')

  // Extract scheme if provided
  let extractedPort: number | null = null
  const schemeMatch = cleaned.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//)
  if (schemeMatch) {
    cleaned = cleaned.substring(schemeMatch[0].length)
  }

  // Check if port is specified (e.g. host:port or path)
  const slashIdx = cleaned.indexOf('/')
  if (slashIdx !== -1) {
    cleaned = cleaned.substring(0, slashIdx)
  }

  const colonIdx = cleaned.lastIndexOf(':')
  if (colonIdx !== -1) {
    const portPart = cleaned.substring(colonIdx + 1)
    const hostPart = cleaned.substring(0, colonIdx)
    const parsedPort = Number(portPart)
    if (isValidPort(parsedPort)) {
      extractedPort = parsedPort
      cleaned = hostPart
    } else {
      return {
        ...defaultResult,
        error: `Invalid port number "${portPart}". Port must be an integer between 1 and 65535.`,
      }
    }
  }

  const host = cleaned.toLowerCase()

  // Specific rejections
  if (host === '0.0.0.0') {
    return {
      ...defaultResult,
      error:
        '0.0.0.0 is an unbound listening address, not a reachable robot host. Enter the specific robot IP.',
    }
  }

  if (host === '255.255.255.255') {
    return {
      ...defaultResult,
      error:
        '255.255.255.255 is a network broadcast address. Unicast robot address required.',
    }
  }

  // Format validation
  if (!isValidHost(host)) {
    return {
      ...defaultResult,
      error: `Invalid address format "${host}". Must be a valid IPv4 address (e.g. 192.168.1.100) or hostname (e.g. jetracer.local).`,
    }
  }

  // Check loopback
  const isLoopback =
    host === 'localhost' || host === '127.0.0.1' || host.startsWith('127.')

  // Check HTTPS / mixed-content
  const isHttps = isHttpsContext(options?.protocolOverride)
  const isMixedContentRisk = isHttps

  // Derive ports
  let rosbridgePort = options?.customRosbridgePort || 9090
  let backendPort = options?.customBackendPort || 8000

  if (extractedPort !== null) {
    // If user provided a specific port in input
    if (extractedPort === 9090 || extractedPort === 8000) {
      if (extractedPort === 9090) rosbridgePort = 9090
      if (extractedPort === 8000) backendPort = 8000
    } else {
      rosbridgePort = extractedPort
    }
  }

  const wsScheme = isHttps ? 'wss' : 'ws'
  const httpScheme = isHttps ? 'https' : 'http'

  const rosbridgeUrl = `${wsScheme}://${host}:${rosbridgePort}`
  const backendUrl = `${httpScheme}://${host}:${backendPort}`

  let warning: string | undefined
  if (isLoopback) {
    warning =
      'This connects to your own computer (loopback), not the physical robot. Use only for local mock testing.'
  } else if (isMixedContentRisk) {
    warning =
      'The app is loaded over HTTPS. Browsers will block unencrypted ws:// and http:// connections. Use HTTP or configure TLS.'
  }

  return {
    valid: true,
    warning,
    isLoopback,
    isMixedContentRisk,
    host,
    rosbridgePort,
    backendPort,
    rosbridgeUrl,
    backendUrl,
  }
}

/**
 * Builds the standard WebSocket URL for Link A (rosbridge_server).
 */
export function buildRosbridgeUrl(
  host: string,
  port = 9090,
  protocolOverride?: string,
): string {
  const scheme = isHttpsContext(protocolOverride) ? 'wss' : 'ws'
  return `${scheme}://${host}:${port}`
}

/**
 * Builds the standard HTTP URL for Link B (FastAPI backend).
 */
export function buildBackendUrl(
  host: string,
  port = 8000,
  protocolOverride?: string,
): string {
  const scheme = isHttpsContext(protocolOverride) ? 'https' : 'http'
  return `${scheme}://${host}:${port}`
}
