import styles from './NewVersionBanner.module.css'
import { isRegistrationClosed } from '@/config/registration'

export const NewVersionBanner = ({ href, title }: { href: string; title: React.ReactNode }) => {
  if (isRegistrationClosed) return null
  return (
    <div className={styles.newVersionBanner}>
      <a href={href}>{title}</a>
    </div>
  )
}
