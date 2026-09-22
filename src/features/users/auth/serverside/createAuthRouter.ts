import { NextApiRequest, NextApiResponse } from 'next'
import NextAuth, { AuthOptions, getServerSession } from 'next-auth'

import { isRegistrationClosed } from '@/config/registration'

import { withRegistrationPolicy } from './registrationPolicy'

export const createAuthRouter = (req: NextApiRequest, res: NextApiResponse, authOptions: AuthOptions) => {
  const options = withRegistrationPolicy(authOptions, isRegistrationClosed, async () => {
    const session = await getServerSession(req, res, authOptions)
    return (session?.user as { id?: string } | undefined)?.id
  })
  return NextAuth(req, res, options)
}
