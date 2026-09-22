import type { AuthOptions } from 'next-auth'
import type { Adapter } from 'next-auth/adapters'

import { registrationClosedUrl } from '@/config/registration'

export class RegistrationClosedError extends Error {
  constructor() {
    super('Classic registration is closed')
    this.name = 'RegistrationClosedError'
  }
}

export function withRegistrationPolicy(
  options: AuthOptions,
  closed: boolean,
  getCurrentUserId: () => Promise<string | undefined>,
): AuthOptions {
  if (!closed) return options
  const adapter = options.adapter as Adapter
  if (!adapter?.getUserByEmail || !adapter.getUserByAccount || !adapter.createUser) {
    throw new Error('Registration policy requires a database adapter')
  }

  return {
    ...options,
    adapter: {
      ...adapter,
      async createUser() {
        // Final guard for stale requests and any future provider added to NextAuth.
        throw new RegistrationClosedError()
      },
    },
    callbacks: {
      ...options.callbacks,
      async signIn(params) {
        const { account, user } = params
        let existingUser = false
        if (account?.type === 'email') {
          // NextAuth has already normalized the identifier before both callbacks.
          existingUser = !!(user.email && (await adapter.getUserByEmail!(user.email)))
        } else if (account?.type === 'oauth') {
          existingUser = !!(await adapter.getUserByAccount!({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          }))
          // Linking to an authenticated Classic account never creates a user.
          if (!existingUser) existingUser = !!(await getCurrentUserId())
          if (!existingUser && user.email) {
            existingUser = !!(await adapter.getUserByEmail!(user.email))
          }
          // NextAuth still enforces OAuthAccountNotLinked; do not auto-link by email.
        }
        if (!existingUser) return registrationClosedUrl
        return options.callbacks?.signIn ? options.callbacks.signIn(params) : true
      },
    },
  }
}
