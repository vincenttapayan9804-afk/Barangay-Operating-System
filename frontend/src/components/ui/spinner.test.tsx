import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from './spinner'

describe('Spinner', () => {
  it('renders with default size', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders label when provided', () => {
    render(<Spinner label="Loading..." />)
    expect(screen.getByText('Loading...')).toBeTruthy()
  })
})
