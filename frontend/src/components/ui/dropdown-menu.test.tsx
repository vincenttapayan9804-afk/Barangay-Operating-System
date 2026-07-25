import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DropdownMenu } from './dropdown-menu'

describe('DropdownMenu', () => {
  it('opens and closes on trigger click', () => {
    render(<DropdownMenu trigger={<button>Menu</button>} items={[{ label: 'Option 1', onClick: vi.fn() }]} />)
    fireEvent.click(screen.getByText('Menu'))
    expect(screen.getByText('Option 1')).toBeTruthy()
    fireEvent.click(screen.getByText('Menu'))
    expect(screen.queryByText('Option 1')).toBeNull()
  })

  it('calls onClick when item is clicked', () => {
    const onClick = vi.fn()
    render(<DropdownMenu trigger={<button>Menu</button>} items={[{ label: 'Delete', onClick, destructive: true }]} />)
    fireEvent.click(screen.getByText('Menu'))
    fireEvent.click(screen.getByText('Delete'))
    expect(onClick).toHaveBeenCalled()
  })
})
