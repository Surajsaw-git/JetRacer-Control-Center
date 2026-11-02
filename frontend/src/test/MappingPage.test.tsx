import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { MappingPage } from '@/pages/Mapping/MappingPage'
import { useConnectionStore } from '@/store/connectionStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { mapManager } from '@/services/map/mapManager'
import { rosbridgeClient } from '@/services/rosbridgeClient'

describe('MappingPage — UI, State & Accessibility (Phase 7A)', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: 'connected',
    })
    useRosDiscoveryStore.getState().clear()
  })

  afterEach(() => {
    cleanup()
    mapManager.destroy()
    vi.restoreAllMocks()
  })

  it('renders the page header and main control tabs', () => {
    render(
      <MemoryRouter>
        <MappingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Mapping & SLAM')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Status/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Pose & TF/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Library/i })).toBeInTheDocument()
  })

  it('switches to Library tab and displays local map library empty state', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <MappingPage />
      </MemoryRouter>
    )

    const libraryTab = screen.getByRole('tab', { name: /Library/i })
    await user.click(libraryTab)

    expect(screen.getByText(/Saved Maps Library/i)).toBeInTheDocument()
    expect(screen.getByText(/No saved maps on this device/i)).toBeInTheDocument()
  })

  it('handles clicking Start Viewing button when map topic is discovered', async () => {
    useRosDiscoveryStore.getState().applyDiscoveryResults(
      {
        topics: ['/map'],
        types: ['nav_msgs/OccupancyGrid'],
      },
      ['/slam_gmapping'],
      []
    )

    let capturedMapCallback: ((msg: unknown) => void) | null = null
    vi.spyOn(rosbridgeClient, 'subscribeTf').mockImplementation(async () => () => {})
    vi.spyOn(rosbridgeClient, 'subscribeOccupancyGrid').mockImplementation(
      async (_topic, onMessage) => {
        capturedMapCallback = onMessage
        return () => {
          capturedMapCallback = null
        }
      }
    )

    const startSpy = vi.spyOn(mapManager, 'start')

    render(
      <MemoryRouter>
        <MappingPage />
      </MemoryRouter>
    )

    const startButton = screen.getByRole('button', { name: /Start Viewing/i })
    expect(startButton).toBeInTheDocument()
    expect(startButton).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(startButton)
    })

    expect(startSpy).toHaveBeenCalledWith('MappingPage', '/map', 1000)
    expect(mapManager.getState()).toBe('waiting')

    act(() => {
      if (capturedMapCallback) {
        capturedMapCallback({
          header: { seq: 1, stamp: { secs: 1700000000, nsecs: 0 }, frame_id: 'map' },
          info: {
            width: 2,
            height: 2,
            resolution: 0.05,
            origin: { position: { x: 0, y: 0 } },
          },
          data: [0, 0, 100, -1],
        })
      }
    })

    expect(mapManager.getState()).toBe('live')
  })

  it('passes automated accessibility audit with 0 critical or serious violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <MappingPage />
      </MemoryRouter>
    )

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false }, // Tested separately
      },
    })

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations).toHaveLength(0)
  })
})
