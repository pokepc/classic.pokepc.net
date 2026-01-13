import { NextApiRequest, NextApiResponse } from 'next'

import { dexToLoadedDex } from '@/features/livingdex/services/parser/support'
import { apiBearerTokenGuard } from '@/features/users/auth/serverside/apiBearerTokenGuard'
import { getSerializableSessionMembership } from '@/features/users/services/getSerializableSessionMembership'
import { getActivePatreonMembershipByUserId } from '@/features/users/services/memberships'
import { apiErrors } from '@/lib/utils/types'
import { isValidIdSchema } from '@/lib/validation/schemas'
import { getPrismaClient } from '@/prisma/getPrismaClient'

const getUserProfileHandler = async (req: NextApiRequest) => {
  const { userId } = req.query

  // Validate userId parameter
  if (!isValidIdSchema(userId)) {
    return apiErrors.invalidRequest
  }

  const client = getPrismaClient()

  // Fetch user with related data
  const user = await client.user.findUnique({
    where: { id: String(userId) },
    include: {
      accounts: {
        select: {
          id: true,
          provider: true,
          type: true,
          providerAccountId: true,
          // Explicitly exclude sensitive OAuth data
          // access_token, refresh_token, id_token, session_state are not selected
        },
      },
      livingDexes: {
        select: {
          id: true,
          title: true,
          gameId: true,
          creationTime: true,
          lastUpdateTime: true,
          // We'll add computed fields after fetching
        },
        orderBy: [
          {
            lastUpdateTime: 'desc',
          },
          {
            creationTime: 'desc',
          },
        ],
      },
    },
  })

  if (!user) {
    return apiErrors.notFound
  }

  // Fetch active membership
  const membership = await getActivePatreonMembershipByUserId(user.id)
  const sessionMembership = getSerializableSessionMembership(membership)

  // For each living dex, we need to parse the data to get the metadata
  // We'll use the existing dexToLoadedDex function pattern
  const livingDexesMetadata = await Promise.all(
    user.livingDexes.map(async (dex) => {
      const dexData = await client.livingDex.findUnique({
        where: { id: dex.id },
      })

      if (!dexData || typeof dexData.data !== 'string') {
        return {
          id: dex.id,
          title: dex.title,
          gameId: dex.gameId,
          gameSetId: null,
          presetId: null,
          caughtRegular: 0,
          totalRegular: 0,
          caughtShiny: 0,
          totalShiny: 0,
          createdAt: dex.creationTime,
          updatedAt: dex.lastUpdateTime,
          totalBoxes: 0,
          totalRegularBoxes: 0,
          totalShinyBoxes: 0,
        }
      }

      // Parse the dex data to extract metadata
      const loadedDex = dexToLoadedDex(dexData)

      return {
        id: loadedDex.id,
        title: loadedDex.title,
        gameId: loadedDex.gameId,
        gameSetId: loadedDex.gameSetId,
        presetId: loadedDex.presetId,
        caughtRegular: loadedDex.caughtRegular,
        totalRegular: loadedDex.totalRegular,
        caughtShiny: loadedDex.caughtShiny,
        totalShiny: loadedDex.totalShiny,
        createdAt: loadedDex.createdAt,
        updatedAt: loadedDex.updatedAt,
        totalBoxes: loadedDex.boxes.length,
        totalRegularBoxes: loadedDex.boxes.filter((box) => !box.shiny).length,
        totalShinyBoxes: loadedDex.boxes.filter((box) => box.shiny).length,
      }
    }),
  )

  // Build response payload
  const responseData = {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      userName: user.userName,
      twitterUsername: user.twitterUsername,
      twitchUsername: user.twitchUsername,
      discordUsername: user.discordUsername,
      isDisabled: user.isDisabled,
      roles: user.roles,
      emailVerified: user.emailVerified,
      createdAt: user.id, // User model doesn't have createdAt, using id as proxy
      updatedAt: user.id, // User model doesn't have updatedAt, using id as proxy
    },
    accounts: user.accounts,
    membership: sessionMembership,
    livingDexes: livingDexesMetadata,
  }

  return {
    statusCode: 200,
    data: responseData,
  }
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const httpMethod = req.method || 'GET'

  // Only allow GET requests
  if (httpMethod !== 'GET') {
    res.status(apiErrors.notAllowed.statusCode).json(apiErrors.notAllowed.data)
    return
  }

  // Validate bearer token
  const authGuard = apiBearerTokenGuard(req)
  if (!authGuard.allowed) {
    res.status(authGuard.statusCode).json(authGuard.data)
    return
  }

  // Handle GET request
  const result = await getUserProfileHandler(req)
  res.status(result.statusCode).json(result.data)
}

export default handler
