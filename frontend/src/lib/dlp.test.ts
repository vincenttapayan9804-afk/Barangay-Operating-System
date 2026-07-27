import { describe, it, expect } from 'vitest'
import { redactSensitiveText } from './dlp'

describe('redactSensitiveText', () => {
  it('redacts an email address', () => {
    expect(redactSensitiveText('Contact juan.delacruz@example.com for info'))
      .toBe('Contact [REDACTED EMAIL] for info')
  })

  it('redacts a PH mobile number', () => {
    expect(redactSensitiveText('Called 09171234567 about the request'))
      .toBe('Called [REDACTED MOBILE] about the request')
  })

  it('redacts a PhilSys card number', () => {
    expect(redactSensitiveText('ID 1234-5678-9012-3456 verified'))
      .toBe('ID [REDACTED PHILSYS ID] verified')
  })

  it('redacts multiple occurrences in one string', () => {
    const input = 'juan@example.com and 09171234567 both on file'
    const result = redactSensitiveText(input)
    expect(result).not.toContain('juan@example.com')
    expect(result).not.toContain('09171234567')
  })

  it('leaves ordinary text untouched', () => {
    expect(redactSensitiveText('Created resident: Juan Dela Cruz'))
      .toBe('Created resident: Juan Dela Cruz')
  })

  it('handles an empty string', () => {
    expect(redactSensitiveText('')).toBe('')
  })
})
