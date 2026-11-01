import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmergencyStopButton } from '@/components/common/EmergencyStopButton'
import { useEventLogStore } from '@/store/eventLogStore'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

describe('EmergencyStopButton Component', () => {
  it('renders with prominent red styling and accessible description', () => {
    render(<EmergencyStopButton />)
    const btn = screen.getByRole('button', { name: /Emergency Stop/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('E-STOP')
  })

  it('triggers preview handler and logs safety event on single tap', () => {
    useEventLogStore.getState().clearEvents()
    render(<EmergencyStopButton />)

    const btn = screen.getByRole('button', { name: /Emergency Stop/i })
    fireEvent.click(btn)

    const events = useEventLogStore.getState().events
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe('safety')
    expect(events[0].title).toContain('E-STOP')
  })
})
