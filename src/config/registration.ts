// Next.js inlines this public setting in both client and server builds.
const registrationClosed = process.env.NEXT_PUBLIC_REGISTRATION_CLOSED ?? 'false'
if (registrationClosed !== 'true' && registrationClosed !== 'false') {
  throw new Error('NEXT_PUBLIC_REGISTRATION_CLOSED must be true or false')
}

export const isRegistrationClosed = registrationClosed === 'true'
export const registrationClosedUrl = '/login?notice=registration-closed'
export const successorLinks = {
  home: 'https://pokepc.net/',
  signup: 'https://pokepc.net/signup',
  signin: 'https://pokepc.net/signin',
} as const
