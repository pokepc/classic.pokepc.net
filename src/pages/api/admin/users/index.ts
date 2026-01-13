import { NextApiRequest, NextApiResponse } from 'next'

import { apiBearerTokenGuard } from '@/features/users/auth/serverside/apiBearerTokenGuard'
import { getSerializableSessionMembership } from '@/features/users/services/getSerializableSessionMembership'
import { apiErrors } from '@/lib/utils/types'
import { getPrismaClient } from '@/prisma/getPrismaClient'

const DEFAULT_PAGE_SIZE = 1000

const getUsersListHandler = async (req: NextApiRequest) => {
  const { page = '1', pageSize = String(DEFAULT_PAGE_SIZE) } = req.query

  // Parse and validate pagination parameters
  const pageNum = parseInt(String(page), 10)
  const pageSizeNum = parseInt(String(pageSize), 10)

  if (isNaN(pageNum) || pageNum < 1) {
    return {
      statusCode: 400,
      data: { message: 'Invalid page parameter. Must be a positive integer.' },
    }
  }

  if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 10000) {
    return {
      statusCode: 400,
      data: { message: 'Invalid pageSize parameter. Must be between 1 and 10000.' },
    }
  }

  const skip = (pageNum - 1) * pageSizeNum
  const take = pageSizeNum

  const client = getPrismaClient()

  // Get total count for pagination metadata
  const totalCount = await client.user.count()

  // Fetch users with related data
  const users = await client.user.findMany({
    skip,
    take,
    orderBy: {
      id: 'asc',
    },
    include: {
      accounts: {
        select: {
          id: true,
          provider: true,
          type: true,
          providerAccountId: true,
        },
      },
      memberships: true,
      _count: {
        select: {
          livingDexes: true,
        },
      },
    },
  })

  // Transform the data to match the required format
  const usersData = users.map((user) => {
    // Get the first membership (users typically have 0 or 1 membership)
    const membership = user.memberships.length > 0 ? user.memberships[0] : null
    const sessionMembership = getSerializableSessionMembership(membership)

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      accounts: user.accounts,
      membership: sessionMembership,
      livingDexCount: user._count.livingDexes,
    }
  })

  const totalPages = Math.ceil(totalCount / pageSizeNum)

  return {
    statusCode: 200,
    data: {
      users: usersData,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    },
  }
}

// Disabled for now, since we don't need it in modern PokePC.
const __disabled_handler = async (req: NextApiRequest, res: NextApiResponse) => {
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
  const result = await getUsersListHandler(req)
  res.status(result.statusCode).json(result.data)
}

export default (_req: NextApiRequest, res: NextApiResponse) => {
  res.status(404).json({ message: 'Endpoint not found' })
}
