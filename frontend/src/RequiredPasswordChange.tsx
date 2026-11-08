import { useState, type FormEvent } from 'react'
import type { ThemeMode } from './LoginExperience'
import './RequiredPasswordChange.css'

type Props = { theme: ThemeMode; token: string; username: string; firstName: string; role: string; onComplete: () => void }

export default function RequiredPasswordChange({ theme, token, username, firstName, role, onComplete }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [complete, setComplete] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmation) { setError('The new passwords do not match.'); return }
    if (newPassword.length < 8 || newPassword.length > 20) { setError('Choose a password between 8 and 20 characters.'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string }
        setError(payload.message || 'Your password could not be changed. Please try again.')
        return
      }
      setComplete(true)
    } catch {
      setError('Could not connect to ClassBridge. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return <main className={'required-password-page' + (theme === 'dark' ? ' is-dark' : '')}>
    <section className="required-password-card" aria-labelledby="required-password-title">
      <aside className="required-password-guide" tabIndex={0} role="img" aria-label="ClassBridge beaver mascot, here to help" title="Here to help">
        <span className="required-password-guide-kicker">YOUR CLASSBRIDGE GUIDE</span>
        <div className="required-password-mascot">
          <img className="required-password-pose-rest" src="/images/beaver-guide-cutout.png" alt="" />
          <img className="required-password-pose-wave" src="/images/beaver-guide-wave.png" alt="" aria-hidden="true" />
        </div>
        <span className="required-password-speech">One step at a time!</span>
      </aside>
      <div className="required-password-content">
        <img className="required-password-logo" src="/images/classbridge-bridge-logo.png" alt="ClassBridge" />
        <p className="required-password-eyebrow">{role.replaceAll('_', ' ')} ACCOUNT · {username}</p>
        <h1 id="required-password-title">{complete ? 'Password updated' : `Welcome${firstName ? `, ${firstName}` : ''}.`}</h1>
        {complete ? <>
          <p className="required-password-intro">Your temporary password has been replaced. Sign in again with your new password to open your workspace.</p>
          <button className="required-password-submit" type="button" onClick={onComplete}>Continue to sign in <span aria-hidden="true">→</span></button>
        </> : <>
          <p className="required-password-intro">Before you continue, choose a new password for your account. Your temporary password will stop working after this change.</p>
          <form className="required-password-form" onSubmit={(event) => void submit(event)}>
            <label>Temporary password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <small>Use 8 to 20 characters. You will need the new password the next time you sign in.</small>
            {error && <p className="required-password-error" role="alert">{error}</p>}
            <button className="required-password-submit" type="submit" disabled={saving || !currentPassword || !newPassword || !confirmation}>{saving ? 'Updating…' : 'Set new password'} <span aria-hidden="true">→</span></button>
          </form>
        </>}
      </div>
    </section>
  </main>
}
