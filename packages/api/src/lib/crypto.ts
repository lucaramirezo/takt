import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'

const KEYLEN = 64
const SALT_BYTES = 16

function scryptAsync(secret: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(secret, salt, keylen, (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)))
  })
}

/** PIN -> "saltHex:hashHex" via scrypt with a per-PIN random salt. Low-entropy secret, so per-PIN salt is mandatory. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scryptAsync(pin, salt, KEYLEN)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

/** Constant-time PIN verification against a stored "saltHex:hashHex". */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const derived = await scryptAsync(pin, Buffer.from(saltHex, 'hex'), expected.length)
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

/** High-entropy (256-bit) device token; returned to the manager exactly once. */
export function generateDeviceToken(): string {
  return randomBytes(32).toString('hex')
}

/** SHA-256 of the device token. Only this hash is stored. */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
