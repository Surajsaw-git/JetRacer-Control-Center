import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { VirtualJoystick } from '@/components/common/VirtualJoystick'

describe('VirtualJoystick Component', () => {
  it('renders with accessible role and attributes', () => {
    const { getByRole } = render(<VirtualJoystick />)
    const joystick = getByRole('slider')
    expect(joystick).toBeInTheDocument()
    expect(joystick).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Virtual Drive Joystick'),
    )
  })

  it('triggers onChange and returns to center on pointerup', () => {
    const handleChange = vi.fn()
    const { getByRole } = render(<VirtualJoystick onChange={handleChange} />)
    const joystick = getByRole('slider')

    // Mock getBoundingClientRect
    vi.spyOn(joystick, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 180,
      height: 180,
      right: 280,
      bottom: 280,
      x: 100,
      y: 100,
      toJSON: () => {},
    })

    // Mock setPointerCapture and releasePointerCapture
    joystick.setPointerCapture = vi.fn()
    joystick.releasePointerCapture = vi.fn()

    // 1. Pointer Down
    fireEvent.pointerDown(joystick, { clientX: 190, clientY: 150, pointerId: 1 })
    expect(handleChange).toHaveBeenCalled()

    // 2. Pointer Move
    fireEvent.pointerMove(joystick, { clientX: 220, clientY: 130, pointerId: 1 })
    expect(handleChange).toHaveBeenCalled()

    // Values should be clamped within -1 to 1
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0]
    expect(lastCall.linear).toBeGreaterThanOrEqual(-1.0)
    expect(lastCall.linear).toBeLessThanOrEqual(1.0)
    expect(lastCall.angular).toBeGreaterThanOrEqual(-1.0)
    expect(lastCall.angular).toBeLessThanOrEqual(1.0)

    // 3. Pointer Up (must return to center { linear: 0, angular: 0 })
    fireEvent.pointerUp(joystick, { pointerId: 1 })
    const finalCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0]
    expect(finalCall).toEqual({ linear: 0, angular: 0 })
  })

  it('resets to center when window loses focus (blur safety)', () => {
    const handleChange = vi.fn()
    const { getByRole } = render(<VirtualJoystick onChange={handleChange} />)
    const joystick = getByRole('slider')

    joystick.setPointerCapture = vi.fn()
    joystick.releasePointerCapture = vi.fn()

    fireEvent.pointerDown(joystick, { clientX: 150, clientY: 150, pointerId: 1 })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    const finalCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0]
    expect(finalCall).toEqual({ linear: 0, angular: 0 })
  })
})
