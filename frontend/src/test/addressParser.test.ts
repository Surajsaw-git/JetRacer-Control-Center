import { describe, it, expect } from 'vitest'
import {
  parseRobotAddress,
  buildRosbridgeUrl,
  buildBackendUrl,
  isValidIPv4,
  isValidHostname,
  isValidHost,
  isValidPort,
} from '@/utils/validators'

describe('Address Parser and URL Builder (Phase 3)', () => {
  describe('Basic format checks', () => {
    it('validates correct IPv4 addresses', () => {
      expect(isValidIPv4('192.168.1.100')).toBe(true)
      expect(isValidIPv4('10.0.0.1')).toBe(true)
      expect(isValidIPv4('127.0.0.1')).toBe(true)
      expect(isValidIPv4('256.0.0.1')).toBe(false)
      expect(isValidIPv4('192.168.01.1')).toBe(false)
      expect(isValidIPv4('invalid-ip')).toBe(false)
    })

    it('validates hostnames and mDNS names', () => {
      expect(isValidHostname('jetracer.local')).toBe(true)
      expect(isValidHostname('robot')).toBe(true)
      expect(isValidHostname('jetson-nano.local')).toBe(true)
      expect(isValidHostname('invalid_host')).toBe(false)
      expect(isValidHostname('')).toBe(false)
    })

    it('validates host strings', () => {
      expect(isValidHost('192.168.1.50')).toBe(true)
      expect(isValidHost('robot.lan')).toBe(true)
      expect(isValidHost('bad host')).toBe(false)
    })

    it('validates port ranges', () => {
      expect(isValidPort(9090)).toBe(true)
      expect(isValidPort(8000)).toBe(true)
      expect(isValidPort('80')).toBe(true)
      expect(isValidPort(0)).toBe(false)
      expect(isValidPort(65536)).toBe(false)
      expect(isValidPort('not-a-port')).toBe(false)
    })
  })

  describe('parseRobotAddress', () => {
    it('accepts bare IPv4 and derives default ports', () => {
      const res = parseRobotAddress('192.168.1.100')
      expect(res.valid).toBe(true)
      expect(res.host).toBe('192.168.1.100')
      expect(res.rosbridgePort).toBe(9090)
      expect(res.backendPort).toBe(8000)
      expect(res.rosbridgeUrl).toBe('ws://192.168.1.100:9090')
      expect(res.backendUrl).toBe('http://192.168.1.100:8000')
      expect(res.isLoopback).toBe(false)
    })

    it('accepts hostnames like jetracer.local', () => {
      const res = parseRobotAddress('jetracer.local')
      expect(res.valid).toBe(true)
      expect(res.host).toBe('jetracer.local')
      expect(res.rosbridgeUrl).toBe('ws://jetracer.local:9090')
      expect(res.backendUrl).toBe('http://jetracer.local:8000')
    })

    it('parses URLs with schemes and trailing slashes', () => {
      const res = parseRobotAddress('http://192.168.1.100:8000/')
      expect(res.valid).toBe(true)
      expect(res.host).toBe('192.168.1.100')
      expect(res.backendPort).toBe(8000)
      expect(res.rosbridgePort).toBe(9090)

      const resWs = parseRobotAddress('ws://192.168.1.100:9090')
      expect(resWs.valid).toBe(true)
      expect(resWs.host).toBe('192.168.1.100')
      expect(resWs.rosbridgePort).toBe(9090)
    })

    it('handles leading and trailing whitespace', () => {
      const res = parseRobotAddress('   192.168.1.55   ')
      expect(res.valid).toBe(true)
      expect(res.host).toBe('192.168.1.55')
    })

    it('rejects 0.0.0.0 with clear reason', () => {
      const res = parseRobotAddress('0.0.0.0')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('0.0.0.0 is an unbound listening address')
    })

    it('rejects broadcast 255.255.255.255 with clear reason', () => {
      const res = parseRobotAddress('255.255.255.255')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('broadcast address')
    })

    it('rejects empty inputs', () => {
      const res = parseRobotAddress('')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('cannot be empty')
    })

    it('flags loopback addresses (127.0.0.1 and localhost) with helpful warning', () => {
      const resIp = parseRobotAddress('127.0.0.1')
      expect(resIp.valid).toBe(true)
      expect(resIp.isLoopback).toBe(true)
      expect(resIp.warning).toContain('own computer (loopback)')

      const resHost = parseRobotAddress('localhost')
      expect(resHost.valid).toBe(true)
      expect(resHost.isLoopback).toBe(true)
      expect(resHost.warning).toContain('own computer (loopback)')
    })

    it('detects mixed-content risk when loaded under HTTPS', () => {
      const res = parseRobotAddress('192.168.1.100', { protocolOverride: 'https:' })
      expect(res.valid).toBe(true)
      expect(res.isMixedContentRisk).toBe(true)
      expect(res.rosbridgeUrl).toBe('wss://192.168.1.100:9090')
      expect(res.backendUrl).toBe('https://192.168.1.100:8000')
      expect(res.warning).toContain('HTTPS')
    })
  })

  describe('buildRosbridgeUrl and buildBackendUrl helpers', () => {
    it('constructs standard ws:// and http:// endpoints', () => {
      expect(buildRosbridgeUrl('192.168.1.100', 9090)).toBe('ws://192.168.1.100:9090')
      expect(buildBackendUrl('192.168.1.100', 8000)).toBe('http://192.168.1.100:8000')
    })

    it('constructs secure wss:// and https:// endpoints when under HTTPS', () => {
      expect(buildRosbridgeUrl('robot.local', 9090, 'https:')).toBe('wss://robot.local:9090')
      expect(buildBackendUrl('robot.local', 8000, 'https:')).toBe('https://robot.local:8000')
    })
  })
})
