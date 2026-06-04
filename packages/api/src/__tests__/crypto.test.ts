import { describe, expect, it } from 'vitest'
import { generateDeviceToken, hashDeviceToken, hashPin, verifyPin } from '../lib/crypto'

describe('hashPin / verifyPin', () => {
  it('round-trips: correct PIN verifies true', async () => {
    const stored = await hashPin('1234')
    expect(await verifyPin('1234', stored)).toBe(true)
  })

  it('wrong PIN returns false', async () => {
    const stored = await hashPin('1234')
    expect(await verifyPin('9999', stored)).toBe(false)
  })

  it('two hashes of the same PIN differ (per-PIN salt)', async () => {
    const a = await hashPin('1234')
    const b = await hashPin('1234')
    expect(a).not.toBe(b)
    expect(await verifyPin('1234', a)).toBe(true)
    expect(await verifyPin('1234', b)).toBe(true)
  })
})

describe('generateDeviceToken / hashDeviceToken', () => {
  it('generateDeviceToken returns 64 hex chars', () => {
    const token = generateDeviceToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashDeviceToken is deterministic and returns 64 hex chars', () => {
    const token = generateDeviceToken()
    const h1 = hashDeviceToken(token)
    const h2 = hashDeviceToken(token)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('token hash does not equal the plaintext token', () => {
    const token = generateDeviceToken()
    expect(hashDeviceToken(token)).not.toBe(token)
  })
})
