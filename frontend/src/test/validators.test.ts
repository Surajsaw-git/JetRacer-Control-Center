import { describe, it, expect } from 'vitest'
import { isValidIPv4, isValidHostname, isValidHost, isValidPort } from '@/utils/validators'

describe('Network Input Validators', () => {
  describe('isValidIPv4', () => {
    it('accepts valid IPv4 addresses', () => {
      expect(isValidIPv4('192.168.1.1')).toBe(true)
      expect(isValidIPv4('10.0.0.1')).toBe(true)
      expect(isValidIPv4('127.0.0.1')).toBe(true)
      expect(isValidIPv4('0.0.0.0')).toBe(true)
      expect(isValidIPv4('255.255.255.255')).toBe(true)
    })

    it('rejects invalid IPv4 addresses', () => {
      expect(isValidIPv4('')).toBe(false)
      expect(isValidIPv4('256.100.0.1')).toBe(false)
      expect(isValidIPv4('192.168.1')).toBe(false)
      expect(isValidIPv4('192.168.1.1.1')).toBe(false)
      expect(isValidIPv4('192.168.01.1')).toBe(false) // Leading zero
      expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false)
      expect(isValidIPv4('192.168.1.-1')).toBe(false)
    })
  })

  describe('isValidHostname', () => {
    it('accepts valid hostnames and mDNS names', () => {
      expect(isValidHostname('jetson')).toBe(true)
      expect(isValidHostname('jetson.local')).toBe(true)
      expect(isValidHostname('robot-01.lan')).toBe(true)
      expect(isValidHostname('my-robot.home.arpa')).toBe(true)
      expect(isValidHostname('localhost')).toBe(true)
    })

    it('rejects invalid hostnames', () => {
      expect(isValidHostname('')).toBe(false)
      expect(isValidHostname('-jetson')).toBe(false)
      expect(isValidHostname('jetson-')).toBe(false)
      expect(isValidHostname('jetson..local')).toBe(false)
      expect(isValidHostname('jetson with spaces')).toBe(false)
    })
  })

  describe('isValidHost', () => {
    it('accepts either valid IPv4 or valid hostname', () => {
      expect(isValidHost('192.168.1.150')).toBe(true)
      expect(isValidHost('jetracer.local')).toBe(true)
      expect(isValidHost('invalid host name!')).toBe(false)
    })
  })

  describe('isValidPort', () => {
    it('accepts valid ports (1 - 65535)', () => {
      expect(isValidPort(80)).toBe(true)
      expect(isValidPort(8000)).toBe(true)
      expect(isValidPort(9090)).toBe(true)
      expect(isValidPort('8000')).toBe(true)
      expect(isValidPort(1)).toBe(true)
      expect(isValidPort(65535)).toBe(true)
    })

    it('rejects invalid ports', () => {
      expect(isValidPort(0)).toBe(false)
      expect(isValidPort(-1)).toBe(false)
      expect(isValidPort(65536)).toBe(false)
      expect(isValidPort('abc')).toBe(false)
      expect(isValidPort('8000.5')).toBe(false)
    })
  })
})
