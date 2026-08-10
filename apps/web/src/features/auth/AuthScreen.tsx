// The dedicated login screen (readings/home-and-navigation.md §8.1): a dark page
// on the platform chrome's own ground rather than a light page with a card, a
// small mark, a large white welcome title, then a bordered dark card holding the
// form. Sign-in, password reset and the MFA gate share it so the three cannot drift.
//
// The mark is the sidebar's, at size — one platform, one mark.

import { Icon } from '@blueprintjs/core'

export function AuthScreen({ heading, instruction, footer, children }: {
  heading: string
  instruction: string
  /** Sits outside the card, bottom right — where the screenshot puts `Need help?`. */
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="auth-page">
      <div className="auth-column">
        <span className="platform-mark auth-mark"><Icon icon="layers" size={18} color="#fff" /></span>
        <h1 className="auth-title">Welcome to Beacon</h1>
        <div className="auth-card">
          <h2 className="auth-heading">{heading}</h2>
          <p className="auth-instruction">{instruction}</p>
          {children}
        </div>
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  )
}
