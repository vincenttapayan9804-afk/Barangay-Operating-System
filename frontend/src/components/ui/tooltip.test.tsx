import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip } from './tooltip'

describe('Tooltip', () => {
  it('renders children and tooltip content', () => {
    render(<Tooltip content="Help text"><button>Hover me</button></Tooltip>)
    expect(screen.getByText('Hover me')).toBeTruthy()
    expect(screen.getByText('Help text')).toBeTruthy()
  })
})
