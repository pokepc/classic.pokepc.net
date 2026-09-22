import { isDevelopmentEnv } from '@/lib/utils/env'
import { getBaseUrl } from '@/lib/utils/urls'

const ASSETS_CACHE_VERSION = '20251226-01'
const ASSETS_CACHE_VERSION_INCREMENTAL = '20251226-01'
const assetsCdn = 'https://static.pokepc.net'

const appConfig = {
  dev: isDevelopmentEnv(),
  baseUrl: getBaseUrl(),
  version: {
    num: '3.20.0',
  },
  themeColor: '#1a1d1f',
  texts: {
    siteName: 'SuperEffective',
    standaloneTitle: 'SuperEffective',
    defaultMetaTitle: 'SuperEffective - Your Pokémon Gaming Companion',
    defaultMetaDescription:
      'PokéPC Classic is a new Pokémon website with news and various tools to assist you ' +
      'in your journey as a trainer. Follow us to stay up-to-date.',
  },
  links: {
    bluesky: 'https://bsky.app/profile/pokepc.net',
    patreon: 'https://www.patreon.com/supereffective',
    github: 'https://github.com/itsjavi',
    github_org: 'https://github.com/itsjavi/supereffective',
    github_site: 'https://github.com/itsjavi/supereffective',
    issue_report: 'https://github.com/itsjavi/supereffective/issues',
    roadmap: 'https://pokepc.net/roadmap',
    feedback: 'https://pokepc.net/feedback',
    changelog: 'https://pokepc.net/changelog',
    discord: 'https://discord.com/invite/3fRXQFtrkN',
    paypal_donate: 'https://www.paypal.me/itsjavidotcom/10',
    legacy_account_recovery_form: 'https://forms.gle/HxnV3qCs1UWJn7Tc6',
  },
  patreon: {
    oauthRedirectUrl: `${getBaseUrl()}/api/callbacks/patreon`,
    webhookCallbackUrl: `${getBaseUrl()}/api/webhooks/patreon`,
  },
  assets: {
    // version: ASSETS_CACHE_VERSION,
    getPokeImgVersion(nid: string): string {
      if (nid.includes('paldea') || nid.includes('bloodmoon')) {
        return ASSETS_CACHE_VERSION_INCREMENTAL
      }

      const dexNum = Number.parseInt(nid.split('-')[0].replace(/^0+/, ''))

      if (dexNum > 1010) {
        return ASSETS_CACHE_VERSION_INCREMENTAL
      }

      return ASSETS_CACHE_VERSION
    },
    imagesUrl: `${assetsCdn}/images`,
  },
  limits: {
    saveBtnDelay: 4000,
    maxDexes: isDevelopmentEnv() ? 4 : 20,
    maxPokemonPerBox: 30,
    maxBoxTitleSize: 15,
    maxDexTitleSize: 32,
  },
}

export default appConfig
