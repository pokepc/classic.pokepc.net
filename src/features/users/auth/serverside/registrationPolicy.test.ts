import { describe, expect, it, mock } from 'bun:test'
import { createHash } from 'node:crypto'
import type { AuthOptions } from 'next-auth'
import type { Adapter, AdapterUser } from 'next-auth/adapters'
import EmailProvider from 'next-auth/providers/email'

import { AuthHandler } from '../../../../../node_modules/next-auth/core'
import callbackHandler from '../../../../../node_modules/next-auth/core/lib/callback-handler'
import { RegistrationClosedError, withRegistrationPolicy } from './registrationPolicy'

const secret = 'registration-test-secret'
const existing: AdapterUser = { id: 'classic-user', email: 'trainer@example.com', emailVerified: new Date() }

function fixture(closed = true) {
  const sendMail = mock(async () => {})
  const createUser = mock(async () => existing)
  const createSession = mock(async (session) => session)
  const lookup = mock(async (email: string) => (email === existing.email ? existing : null))
  const linked = mock(async () => null as AdapterUser | null)
  const currentUser = mock(async () => undefined as string | undefined)
  const adapter: Adapter = {
    createUser,
    getUser: async () => existing,
    getUserByEmail: lookup,
    getUserByAccount: linked,
    updateUser: async () => existing,
    linkAccount: async () => undefined,
    createSession,
    getSessionAndUser: async () => null,
    updateSession: async () => null,
    deleteSession: async () => undefined,
    createVerificationToken: async (token) => token,
    useVerificationToken: async ({ identifier }) => ({
      identifier,
      token: 'token',
      expires: new Date(Date.now() + 60000),
    }),
  }
  const base: AuthOptions = {
    secret,
    adapter,
    providers: [EmailProvider({ sendVerificationRequest: sendMail })],
    pages: { signIn: '/login', error: '/auth/error' },
    logger: { error: mock(() => {}), warn: mock(() => {}), debug: mock(() => {}) },
  }
  const options = withRegistrationPolicy(base, closed, currentUser)
  const request = (action: 'signin' | 'callback', email: string) => {
    const csrfToken = 'test-csrf'
    const hash = createHash('sha256')
      .update(csrfToken + secret)
      .digest('hex')
    return AuthHandler({
      options,
      req: {
        action,
        providerId: 'email',
        method: action === 'signin' ? 'POST' : 'GET',
        headers: { host: 'localhost:3001' },
        cookies: { 'next-auth.csrf-token': `${csrfToken}|${hash}` },
        body: { email, csrfToken },
        query: { email, token: 'token' },
      },
    })
  }
  const oauth = (email: string | null = 'new@example.com') =>
    options.callbacks!.signIn!({
      user: { id: 'provider-profile-id', email },
      account: { provider: 'patreon', providerAccountId: 'patron', type: 'oauth' },
    })
  return { base, options, adapter, request, oauth, lookup, linked, currentUser, sendMail, createUser, createSession }
}

describe('Classic registration closure', () => {
  it('leaves the original configuration untouched when disabled', () => {
    const f = fixture(false)
    expect(f.options).toBe(f.base)
  })

  it('blocks direct email sign-in before sending a message', async () => {
    const f = fixture()
    expect((await f.request('signin', 'new@example.com')).redirect).toBe('/login?notice=registration-closed')
    expect(f.sendMail).not.toHaveBeenCalled()
    expect(f.createUser).not.toHaveBeenCalled()
    expect(f.createSession).not.toHaveBeenCalled()
  })

  it('allows registered emails after NextAuth normalization', async () => {
    const f = fixture()
    await f.request('signin', ' TRAINER@EXAMPLE.COM ')
    expect(f.lookup).toHaveBeenCalledWith(existing.email)
    expect(f.sendMail).toHaveBeenCalledTimes(1)
    expect(f.createUser).not.toHaveBeenCalled()
  })

  it('blocks previously issued links and manual tokens for unknown emails', async () => {
    const f = fixture()
    expect((await f.request('callback', 'new@example.com')).redirect).toBe('/login?notice=registration-closed')
    expect(f.createUser).not.toHaveBeenCalled()
    expect(f.createSession).not.toHaveBeenCalled()
  })

  it('allows an existing email token to create a session', async () => {
    const f = fixture()
    await f.request('callback', existing.email)
    expect(f.createSession).toHaveBeenCalledTimes(1)
    expect(f.createUser).not.toHaveBeenCalled()
  })

  it('retains normal registration when disabled', async () => {
    const f = fixture(false)
    await f.request('signin', 'new@example.com')
    await f.request('callback', 'new@example.com')
    expect(f.sendMail).toHaveBeenCalledTimes(1)
    expect(f.createUser).toHaveBeenCalledTimes(1)
    expect(f.createSession).toHaveBeenCalledTimes(1)
  })

  it('keeps expired-token errors intact', async () => {
    const f = fixture()
    f.adapter.useVerificationToken = async () => null
    f.options.adapter!.useVerificationToken = f.adapter.useVerificationToken
    expect((await f.request('callback', existing.email)).redirect).toContain('error=Verification')
    expect(f.createSession).not.toHaveBeenCalled()
  })

  it('blocks unknown Patreon identities, including missing emails', async () => {
    const f = fixture()
    expect(await f.oauth()).toBe('/login?notice=registration-closed')
    expect(await f.oauth(null)).toBe('/login?notice=registration-closed')
  })

  it('preserves linked Patreon access even when its email changes', async () => {
    const f = fixture()
    f.linked.mockResolvedValue(existing)
    expect(await f.oauth()).toBe(true)
    expect(f.currentUser).not.toHaveBeenCalled()
  })

  it('preserves authenticated Patreon linking', async () => {
    const f = fixture()
    f.currentUser.mockResolvedValue(existing.id)
    expect(await f.oauth()).toBe(true)
  })

  it('leaves existing-email account linking to NextAuth without enabling unsafe linking', async () => {
    const f = fixture()
    expect(await f.oauth(existing.email)).toBe(true)
    expect(f.options.providers).toBe(f.base.providers)
    await expect(
      callbackHandler({
        profile: { id: 'patreon-profile', email: existing.email },
        account: { provider: 'patreon', providerAccountId: 'unlinked', type: 'oauth' },
        options: {
          ...f.options,
          events: {},
          provider: { id: 'patreon', type: 'oauth' },
          session: { strategy: 'database', generateSessionToken: () => 'new-session' },
        } as Parameters<typeof callbackHandler>[0]['options'],
      }),
    ).rejects.toThrow('Another account already exists with the same e-mail address')
    expect(f.createUser).not.toHaveBeenCalled()
  })

  it('preserves an existing database session', async () => {
    const f = fixture()
    f.options.adapter!.getSessionAndUser = async () => ({
      user: existing,
      session: { userId: existing.id, sessionToken: 'existing-session', expires: new Date(Date.now() + 86400000) },
    })
    const result = await AuthHandler({
      options: f.options,
      req: {
        action: 'session',
        method: 'GET',
        cookies: { 'next-auth.session-token': 'existing-session' },
        headers: { host: 'localhost:3001' },
      },
    })
    expect(result.body).toMatchObject({ user: { email: existing.email } })
    expect(f.createUser).not.toHaveBeenCalled()
  })

  it('fails closed on lookup errors and retains the error', async () => {
    const f = fixture()
    const error = new Error('database unavailable')
    f.lookup.mockRejectedValue(error)
    await expect(f.oauth(existing.email)).rejects.toThrow(error)
    await expect(f.request('signin', existing.email)).rejects.toThrow('database unavailable')
    expect(f.sendMail).not.toHaveBeenCalled()
    expect(f.createUser).not.toHaveBeenCalled()
    expect(f.createSession).not.toHaveBeenCalled()
  })

  it('guards user creation even if a provider bypasses the callback', async () => {
    const f = fixture()
    await expect(
      f.options.adapter!.createUser!({ email: 'new@example.com', emailVerified: null }),
    ).rejects.toBeInstanceOf(RegistrationClosedError)
    expect(f.createUser).not.toHaveBeenCalled()
  })
})
