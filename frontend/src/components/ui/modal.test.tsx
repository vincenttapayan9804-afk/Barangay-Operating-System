import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './modal'

describe('Modal', () => {
  it('renders when open', () => {
    render(<Modal open title="Test" onClose={vi.fn()}><p>Content</p></Modal>)
    expect(screen.getByText('Test')).toBeTruthy()
    expect(screen.getByText('Content')).toBeTruthy()
  })

  it('does not render when closed', () => {
    render(<Modal open={false} title="Test" onClose={vi.fn()}><p>Content</p></Modal>)
    expect(screen.queryByText('Test')).toBeNull()
  })

  it('calls onClose on escape', () => {
    const onClose = vi.fn()
    render(<Modal open title="Test" onClose={onClose}><p>Content</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
