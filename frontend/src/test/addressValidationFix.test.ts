import { describe, it, expect } from 'vitest'
import {
  isValidHost,
  isValidHostname,
  isValidIPv4,
  parseRobotAddress,
} from '@/utils/validators'

describe('Address Validation & Text Integrity Fixes (Bug 3)', () => {
  it('strictly rejects purely numeric dotted strings like "192.168137.43" as both IPv4 and hostname', () => {
    // Missing dot between 168 and 137: 192.168137.43 has only 3 octets
    expect(isValidIPv4('192.168137.43')).toBe(false)

    // RFC 1123 / DNS rule: A multi-label hostname cannot be purely numeric digits and dots
    expect(isValidHostname('192.168137.43')).toBe(false)
    expect(isValidHost('192.168137.43')).toBe(false)

    const parsed = parseRobotAddress('192.168137.43')
    expect(parsed.valid).toBe(false)
    expect(parsed.error).toMatch(/Invalid address format/i)
  })

  it('rejects other malformed numeric dotted inputs that masquerade as hostnames', () => {
    expect(isValidHost('1.2.3')).toBe(false)
    expect(isValidHost('192.168.1')).toBe(false)
    expect(isValidHost('10.0.0.999')).toBe(false)
    expect(isValidHost('300.400.500.600')).toBe(false)
  })

  it('preserves all dots in a valid address "192.168.137.43" across normalization and parsing', () => {
    const parsed = parseRobotAddress('192.168.137.43')
    expect(parsed.valid).toBe(true)
    expect(parsed.host).toBe('192.168.137.43')
    expect(parsed.rosbridgeUrl).toBe('ws://192.168.137.43:9090')
    expect(parsed.backendUrl).toBe('http://192.168.137.43:8000')

    // Also with whitespace
    const parsedPadded = parseRobotAddress('  192.168.137.43  ')
    expect(parsedPadded.valid).toBe(true)
    expect(parsedPadded.host).toBe('192.168.137.43')
  })

  it('allows genuine hostnames and mDNS names containing letters', () => {
    expect(isValidHost('jetracer.local')).toBe(true)
    expect(isValidHost('jetson-nano')).toBe(true)
    expect(isValidHost('robot1.lab.internal')).toBe(true)
  })
})
