import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoryPage } from '@/pages/History/HistoryPage'
import { useEventLogStore } from '@/store/eventLogStore'

describe('History Page & Filter Logic', () => {
  beforeEach(() => {
    useEventLogStore.getState().clearEvents()
    useEventLogStore.getState().addEvent({
      type: 'safety',
      title: 'Emergency Stop Engaged',
      detail: 'Test detail A',
    })
    useEventLogStore.getState().addEvent({
      type: 'settings',
      title: 'Host IP Updated',
      detail: 'Set to 192.168.1.50',
    })
    useEventLogStore.getState().addEvent({
      type: 'general',
      title: 'Dashboard Opened',
      detail: 'Session started',
    })
  })

  it('renders all logged events initially', () => {
    render(<HistoryPage />)
    expect(screen.getByText('Emergency Stop Engaged')).toBeInTheDocument()
    expect(screen.getByText('Host IP Updated')).toBeInTheDocument()
    expect(screen.getByText('Dashboard Opened')).toBeInTheDocument()
  })

  it('filters events by search query', () => {
    render(<HistoryPage />)
    const searchInput = screen.getByPlaceholderText(/Search event logs/i)
    fireEvent.change(searchInput, { target: { value: 'Host IP' } })

    expect(screen.getByText('Host IP Updated')).toBeInTheDocument()
    expect(screen.queryByText('Emergency Stop Engaged')).not.toBeInTheDocument()
  })

  it('clears event history upon confirmed action', () => {
    render(<HistoryPage />)
    const clearBtn = screen.getByRole('button', { name: /Clear Log/i })
    fireEvent.click(clearBtn)

    // Confirm dialog button
    const confirmClear = screen.getByRole('button', { name: 'Clear Log' })
    fireEvent.click(confirmClear)

    expect(useEventLogStore.getState().events.length).toBe(0)
  })
})
