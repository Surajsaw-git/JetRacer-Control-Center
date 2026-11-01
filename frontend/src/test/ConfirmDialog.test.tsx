import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

describe('ConfirmDialog Component', () => {
  it('renders standard confirmation dialog and calls onConfirm', () => {
    const handleConfirm = vi.fn()
    const handleOpenChange = vi.fn()

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Confirm Restart"
        description="Are you sure you want to restart?"
        onConfirm={handleConfirm}
      />,
    )

    expect(screen.getByText('Confirm Restart')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to restart?')).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmBtn).toBeEnabled()

    fireEvent.click(confirmBtn)
    expect(handleConfirm).toHaveBeenCalled()
    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })

  it('enforces typed confirmation string before enabling confirm button', () => {
    const handleConfirm = vi.fn()
    const handleOpenChange = vi.fn()

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Shutdown Robot"
        description="Type SHUTDOWN to proceed"
        requiredTypedText="SHUTDOWN"
        confirmText="Shutdown"
        onConfirm={handleConfirm}
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: 'Shutdown' })
    // Initially disabled
    expect(confirmBtn).toBeDisabled()

    // Type incorrect text
    const input = screen.getByLabelText(/Type SHUTDOWN to confirm/i)
    fireEvent.change(input, { target: { value: 'WRONG' } })
    expect(confirmBtn).toBeDisabled()

    // Type exact required text
    fireEvent.change(input, { target: { value: 'SHUTDOWN' } })
    expect(confirmBtn).toBeEnabled()

    fireEvent.click(confirmBtn)
    expect(handleConfirm).toHaveBeenCalled()
  })
})
