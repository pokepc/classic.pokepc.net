import { isRegistrationClosed, successorLinks } from '@/config/registration'

import { ButtonLink } from './Button'
import styles from './RetirementNotice.module.css'

function trackReferral() {
  const analyticsWindow = window as Window & {
    plausible?: (event: string, options: { props: { placement: 'login' } }) => void
  }
  try {
    analyticsWindow.plausible?.('Classic successor CTA', { props: { placement: 'login' } })
  } catch {
    // Analytics must never prevent navigation.
  }
}

export function RetirementNotice({ blocked = false }: { blocked?: boolean }) {
  if (!isRegistrationClosed) return null

  return (
    <section aria-label="The future of PokéPC Classic" className={styles.notice}>
      <div role={blocked ? 'status' : undefined}>
        <h2>New Classic accounts are closed</h2>
        <p>
          Your next adventure starts on <strong>PokéPC.net</strong>—with richer Livingdex organization, progress for
          multiple games, and shiny-hunting tools.
        </p>
      </div>
      <div className={styles.actions}>
        <ButtonLink className={styles.signup} href={successorLinks.signup} onClick={trackReferral}>
          Create your account on PokéPC.net
        </ButtonLink>
        <span>
          Already on PokéPC.net?{' '}
          <a href={successorLinks.signin} onClick={trackReferral}>
            Sign in
          </a>
        </span>
      </div>
      <p className={styles.reassurance}>
        Classic retires in <strong>2027</strong>. Existing accounts will transition seamlessly through automatic
        migration or merging. <strong>No action needed now.</strong>
      </p>
    </section>
  )
}
