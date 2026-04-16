/**
 * Password hashing using Node.js crypto (scrypt).
 *
 * No external dependencies needed.
 */
import { randomBytes, scryptSync } from "node:crypto"
import { Effect } from "effect"

const SALT_LENGTH = 16
const KEY_LENGTH = 64

export const hash = (password: string): Effect.Effect<string> =>
  Effect.sync(() => {
    const salt = randomBytes(SALT_LENGTH).toString("hex")
    const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex")
    return `${salt}:${derived}`
  })

export const verify = (password: string, stored: string): Effect.Effect<boolean> =>
  Effect.sync(() => {
    const [salt, key] = stored.split(":")
    if (!salt || !key) return false
    const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex")
    return derived === key
  })
