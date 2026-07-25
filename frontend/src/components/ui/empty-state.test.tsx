import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No data" description="Nothing here yet" />)
    expect(screen.getByText('No data')).toBeTruthy()
    expect(screen.getByText('Nothing here yet')).toBeTruthy()
  })

  it('renders action button and handles click', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Empty" action={{ label: 'Add', onClick }} />)
    fireEvent.click(screen.getByText('Add'))
    expect(onClick).toHaveBeenCalled()
  })
})
