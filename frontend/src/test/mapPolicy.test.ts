import { describe, it, expect } from 'vitest'
import {
  assertMapSubscriptionAllowed,
  assertTfSubscriptionAllowed,
  assertGetMapServiceAllowed,
  MAX_MAP_SUBSCRIPTIONS,
  MAX_TF_SUBSCRIPTIONS,
} from '@/services/rosPolicy'

describe('mapPolicy — Safety & Policy Constraints for Map and TF (Phase 7A)', () => {
  describe('assertMapSubscriptionAllowed', () => {
    it('permits authorized MapService caller with valid parameters', () => {
      expect(() =>
        assertMapSubscriptionAllowed('MapService', 'nav_msgs/OccupancyGrid', 1000, 0)
      ).not.toThrow()
    })

    it('rejects unauthorized caller identity', () => {
      expect(() =>
        assertMapSubscriptionAllowed('AnonymousCaller', 'nav_msgs/OccupancyGrid', 1000, 0)
      ).toThrow(/Unauthorized caller/)
    })

    it('rejects incorrect message type', () => {
      expect(() =>
        assertMapSubscriptionAllowed('MapService', 'sensor_msgs/LaserScan', 1000, 0)
      ).toThrow(/requires "nav_msgs\/OccupancyGrid"/)
    })

    it('rejects throttle rate below safety threshold (<1000ms)', () => {
      expect(() =>
        assertMapSubscriptionAllowed('MapService', 'nav_msgs/OccupancyGrid', 500, 0)
      ).toThrow(/is below the minimum safety threshold/)
    })

    it('rejects concurrent subscriptions exceeding MAX_MAP_SUBSCRIPTIONS (1)', () => {
      expect(() =>
        assertMapSubscriptionAllowed('MapService', 'nav_msgs/OccupancyGrid', 1000, MAX_MAP_SUBSCRIPTIONS)
      ).toThrow(/Maximum active Map subscriptions \(1\) exceeded/)
    })
  })

  describe('assertTfSubscriptionAllowed', () => {
    it('permits authorized TfService caller with valid parameters', () => {
      expect(() =>
        assertTfSubscriptionAllowed('TfService', 'tf2_msgs/TFMessage', 0)
      ).not.toThrow()
    })

    it('rejects unauthorized caller identity', () => {
      expect(() =>
        assertTfSubscriptionAllowed('HackService', 'tf2_msgs/TFMessage', 0)
      ).toThrow(/Unauthorized caller/)
    })

    it('rejects incorrect message type', () => {
      expect(() =>
        assertTfSubscriptionAllowed('TfService', 'geometry_msgs/Pose', 0)
      ).toThrow(/requires "tf2_msgs\/TFMessage"/)
    })

    it('rejects concurrent subscriptions exceeding MAX_TF_SUBSCRIPTIONS (2)', () => {
      expect(() =>
        assertTfSubscriptionAllowed('TfService', 'tf2_msgs/TFMessage', MAX_TF_SUBSCRIPTIONS)
      ).toThrow(/Maximum active TF subscriptions \(2\) exceeded/)
    })
  })

  describe('assertGetMapServiceAllowed', () => {
    it('permits authorized MapService caller for nav_msgs/GetMap', () => {
      expect(() =>
        assertGetMapServiceAllowed('MapService', 'nav_msgs/GetMap')
      ).not.toThrow()
    })

    it('rejects unauthorized caller', () => {
      expect(() =>
        assertGetMapServiceAllowed('RawClient', 'nav_msgs/GetMap')
      ).toThrow(/Unauthorized caller/)
    })

    it('rejects mutating or non-allowlisted service types', () => {
      expect(() =>
        assertGetMapServiceAllowed('MapService', 'std_srvs/Empty')
      ).toThrow(/requires serviceType "nav_msgs\/GetMap"/)
    })
  })
})
