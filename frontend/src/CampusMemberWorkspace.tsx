import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import AnnouncementsPanel from './AnnouncementsPanel'
import type { ThemeMode } from './LoginExperience'
import './CampusMemberWorkspace.css'

type Role = 'PARENT' | 'STUDENT'
type Profile = { userAccountId: number; username: string; role: Role; firstName: string | null; lastName: string | null; email?: string | null; emailVerified?: boolean; phoneNumber?: string | null }
type AvatarType = 'INITIALS' | 'ANIMAL' | 'PHOTO'
type Appearance = { avatarType: AvatarType; animal: string | null; imageDataUrl: string | null }
type View = 'today' | 'announcements' | 'profile'
type Props = { theme: ThemeMode; token: string; profile: Profile; onToggleTheme: () => void; onSignOut: () => void; onSessionExpired: () => void }

const viewHash = (view: View, role: Role) => `#campus/${role.toLowerCase()}${view === 'today' ? '' : '/' + view}`
function readView(): View {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/')
  if (parts[2] === 'announcements') return 'announcements'
  if (parts[2] === 'profile') return 'profile'
  return 'today'
}
type Animal = { id: string; name: string; age: 'adult' | 'student'; column: number; row: number }
const species = ['Lion', 'Bear', 'Koala', 'Turtle', 'Owl', 'Hippo', 'Snake', 'Fox', 'Rabbit', 'Otter', 'Cheetah']
const animals: Animal[] = species.flatMap((name, index) => (['adult', 'student'] as const).map((age) => ({
  id: name.toUpperCase() + '_' + age.toUpperCase(), name, age, column: index % 4, row: Math.floor(index / 4),
})))

function animalStyle(animal: Animal) {
  return {
    backgroundImage: `url('/images/profile-animals-${animal.age === 'adult' ? 'adults' : 'students'}.jpg')`,
    backgroundSize: '400% 400%',
    backgroundPosition: `${(animal.column / 3) * 100}% ${['-5.56%', '38.89%', '83.33%'][animal.row]}`,
  }
}
function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CB' }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.' }
class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', 'Bearer ' + token)
  headers.set('Accept', 'application/json')
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers })
  const text = await response.text()
  let body: { message?: string } | null = null
  if (text) { try { body = JSON.parse(text) as { message?: string } } catch { body = null } }
  if (!response.ok) throw new ApiError(body?.message || `The request could not be completed (${response.status}).`, response.status)
  return (text ? body : null) as T
}

export default function CampusMemberWorkspace({ theme, token, profile, onToggleTheme, onSignOut, onSessionExpired }: Props) {
  const [view, setView] = useState<View>(readView)
  const [appearance, setAppearance] = useState<Appearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceDraft, setAppearanceDraft] = useState<Appearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [savedEmail, setSavedEmail] = useState(profile.email || '')
  const [emailDraft, setEmailDraft] = useState(profile.email || '')
  const [emailVerified, setEmailVerified] = useState(Boolean(profile.emailVerified))
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [phoneDraft, setPhoneDraft] = useState(profile.phoneNumber || '')
  const [savedPhone, setSavedPhone] = useState(profile.phoneNumber || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [profileStatus, setProfileStatus] = useState('')
  const [errorToast, setErrorToast] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [appearanceLoading, setAppearanceLoading] = useState(true)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | null>(null)
  const fullName = useMemo(() => [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username, [profile.firstName, profile.lastName, profile.username])
  const greetingName = profile.firstName || profile.username
  const selectedAnimal = (value: Appearance) => animals.find((animal) => animal.id === value.animal)

  const notifyError = useCallback((message: string) => {
    setErrorToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setErrorToast(''), 5200)
  }, [])

  const handleApiError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) onSessionExpired()
    else notifyError(errorMessage(error))
  }, [notifyError, onSessionExpired])

  useEffect(() => {
    const sync = () => setView(readView())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileMenuOpen(false)
    }
    const closeDialog = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfirmSignOut(false) }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeDialog)
    return () => { document.removeEventListener('pointerdown', closeMenu); document.removeEventListener('keydown', closeDialog) }
  }, [])

  useEffect(() => {
    let active = true
    api<Appearance>('/api/auth/appearance', token)
      .then((value) => { if (active && value) { setAppearance(value); setAppearanceDraft(value) } })
      .catch((error) => { if (active) handleApiError(error) })
      .finally(() => { if (active) setAppearanceLoading(false) })
    return () => { active = false }
  }, [handleApiError, token])

  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current) }, [])

  function navigate(next: View) {
    setProfileMenuOpen(false)
    const hash = viewHash(next, profile.role)
    if (window.location.hash !== hash) window.history.pushState({}, '', hash)
    setView(next)
    setProfileStatus('')
  }

  function avatar(value: Appearance, className = '') {
    const animal = selectedAnimal(value)
    return <span className={`member-avatar member-avatar-${value.avatarType.toLowerCase()} ${className}`} aria-hidden="true">
      {value.avatarType === 'PHOTO' && value.imageDataUrl ? <img src={value.imageDataUrl} alt="" /> : value.avatarType === 'ANIMAL' && animal ? <span className="member-animal-art" style={animalStyle(animal)} /> : initials(fullName)}
    </span>
  }

  async function saveAppearance() {
    setBusy(true); setProfileStatus('')
    try {
      const saved = await api<Appearance>('/api/auth/appearance', token, { method: 'PUT', body: JSON.stringify(appearanceDraft) })
      if (saved) { setAppearance(saved); setAppearanceDraft(saved) }
      setProfileStatus('Your profile picture has been saved.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { notifyError('Choose a JPG, PNG or WebP image.'); return }
    if (file.size > 2 * 1024 * 1024) { notifyError('Profile photos must be 2 MB or smaller.'); return }
    const reader = new FileReader()
    reader.onload = () => setAppearanceDraft({ avatarType: 'PHOTO', animal: null, imageDataUrl: String(reader.result) })
    reader.onerror = () => notifyError('That photo could not be opened. Choose another image.')
    reader.readAsDataURL(file)
  }

  async function saveEmail() {
    const next = emailDraft.trim()
    if (!next) { notifyError('Enter an email address first.'); return }
    if (next.toLocaleLowerCase() === savedEmail.trim().toLocaleLowerCase()) { setProfileStatus('This email address is already saved.'); return }
    setBusy(true); setProfileStatus('')
    try {
      await api('/api/auth/email', token, { method: 'PUT', body: JSON.stringify({ email: next }) })
      setSavedEmail(next); setEmailVerified(false); setVerificationSent(false); setVerificationCode('')
      setProfileStatus('Email saved. Verify it before using it for password recovery.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  async function sendVerificationCode() {
    setBusy(true); setProfileStatus('')
    try {
      await api('/api/auth/email-verification/request', token, { method: 'POST' })
      setVerificationSent(true); setProfileStatus('A six-digit code has been sent to your email.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  async function confirmVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setProfileStatus('')
    try {
      await api('/api/auth/email-verification/confirm', token, { method: 'POST', body: JSON.stringify({ code: verificationCode }) })
      setEmailVerified(true); setVerificationSent(false); setVerificationCode(''); setProfileStatus('Your email address is verified.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  async function savePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setProfileStatus('')
    try {
      const updated = await api<Profile>('/api/auth/phone', token, { method: 'PUT', body: JSON.stringify({ phoneNumber: phoneDraft.trim() }) })
      setPhoneDraft(updated.phoneNumber || phoneDraft.trim())
      setSavedPhone(updated.phoneNumber || phoneDraft.trim())
      setProfileStatus('Your phone number has been updated.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword.length < 8 || newPassword.length > 20) { notifyError('Your new password must be 8 to 20 characters long.'); return }
    if (newPassword !== passwordConfirmation) { notifyError('The new password and confirmation do not match.'); return }
    setBusy(true); setProfileStatus('')
    try {
      await api('/api/auth/change-password', token, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
      setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation(''); setProfileStatus('Your password has been changed.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  return <main className="member-workspace">
    <header className="member-topbar">
      <button className="member-brand" onClick={() => navigate('today')} type="button" aria-label="ClassBridge home"><img src="/images/classbridge-bridge-logo.png" alt="ClassBridge" /></button>
      <nav className="member-nav" aria-label="School workspace">
        {([['today', 'Today'], ['announcements', 'School updates'], ['profile', 'My profile']] as const).map(([key, label]) => <button className={view === key ? 'is-active' : ''} key={key} onClick={() => navigate(key)} type="button" aria-current={view === key ? 'page' : undefined}>{label}</button>)}
      </nav>
      <div className="member-top-actions">
        <button className="member-theme-button" onClick={onToggleTheme} type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? '☼' : '☾'}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
        <div className="member-profile-menu" ref={profileMenuRef}><button className="member-user-button" onClick={() => setProfileMenuOpen((open) => !open)} type="button" aria-expanded={profileMenuOpen} aria-haspopup="menu">{avatar(appearance, 'member-avatar-small')}<span>{fullName}</span><b>⌄</b></button>
          {profileMenuOpen && <div className="member-dropdown" role="menu"><div className="member-dropdown-person">{avatar(appearance)}<strong>{fullName}</strong><small>{profile.role === 'PARENT' ? 'Parent account' : 'Student account'}</small></div><button role="menuitem" onClick={() => navigate('profile')} type="button">My profile <span>Account settings</span></button><button role="menuitem" onClick={() => navigate('announcements')} type="button">School updates <span>Announcements</span></button><button className="member-signout-link" role="menuitem" onClick={() => { setProfileMenuOpen(false); setConfirmSignOut(true) }} type="button">Sign out</button></div>}
        </div>
      </div>
    </header>

    <div className="member-content">
      <section className="member-welcome">
        <div className="member-welcome-mascot" title="Your ClassBridge guide"><img className="member-mascot-rest" src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><img className="member-mascot-wave" src="/images/beaver-guide-wave.png" alt="" /></div>
        <div><p className="member-kicker">YOUR SCHOOL COMMUNITY · {profile.role === 'PARENT' ? 'PARENT' : 'STUDENT'}</p><h1>Good day, {greetingName}.</h1><p>School updates and your account, together in one place.</p></div>
      </section>

      {view === 'today' && <section className="member-shortcuts" aria-label="Your workspace">
        <button onClick={() => navigate('announcements')} type="button"><span className="member-shortcut-mark river">↗</span><span><small>THE SCHOOL NOTICEBOARD</small><strong>School updates</strong><em>Read announcements shared by your school.</em></span><b>→</b></button>
        <button onClick={() => navigate('profile')} type="button"><span className="member-shortcut-mark wood">⌂</span><span><small>YOUR ACCOUNT</small><strong>Profile and settings</strong><em>Update your contact details and profile picture.</em></span><b>→</b></button>
      </section>}

      {view === 'announcements' && <AnnouncementsPanel token={token} role={profile.role} />}

      {view === 'profile' && <section className="member-profile-page">
        <div className="member-page-heading"><div><p className="member-kicker">ACCOUNT DETAILS</p><h2>Your profile</h2><p>Your school manages your name, username, and role.</p></div><span className="member-role-chip">{profile.role === 'PARENT' ? 'Parent' : 'Student'}</span></div>
        {profileStatus && <p className="member-status" role="status">{profileStatus}</p>}
        <div className="member-profile-layout">
          <div className="member-profile-main">
            <section className="member-panel">
              <div className="member-profile-facts"><div><small>FULL NAME</small><strong>{fullName}</strong></div><div><small>USERNAME</small><strong>{profile.username}</strong></div><div><small>ROLE</small><strong>{profile.role === 'PARENT' ? 'Parent' : 'Student'}</strong></div></div>
              <div className="member-panel-title"><div><p className="member-kicker">CONTACT DETAILS</p><h3>Keep your details current</h3></div></div>
              <div className="member-form-row"><div><label htmlFor="member-email">Email address</label><input id="member-email" autoComplete="email" type="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="Add an email address" /></div><button className="member-secondary-action" disabled={busy || !emailDraft.trim()} onClick={() => void saveEmail()} type="button">{busy ? 'Saving…' : 'Save email'}</button></div>
              <p className={'member-verify-state ' + (emailVerified ? 'is-verified' : '')}>{emailVerified ? '✓ Verified email address' : savedEmail ? 'This email must be verified before password recovery.' : 'Add and verify an email address for password recovery.'}</p>
              {savedEmail && !emailVerified && <div className="member-verification-actions">{!verificationSent ? <button className="member-text-action" disabled={busy} onClick={() => void sendVerificationCode()} type="button">Send a 6-digit verification code</button> : <form className="member-code-form" onSubmit={confirmVerification}><label className="sr-only" htmlFor="member-verification-code">Six-digit email verification code</label><input id="member-verification-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" /><button className="member-secondary-action" disabled={busy || verificationCode.length !== 6} type="submit">{busy ? 'Checking…' : 'Verify email'}</button></form>}</div>}
              <form className="member-phone-form" onSubmit={savePhone}><label htmlFor="member-phone">Phone number</label><div className="member-form-row"><input id="member-phone" autoComplete="tel" maxLength={32} type="tel" value={phoneDraft} onChange={(event) => setPhoneDraft(event.target.value)} placeholder="Add a phone number" /><button className="member-secondary-action" disabled={busy || !phoneDraft.trim() || phoneDraft.trim() === savedPhone} type="submit">{busy ? 'Saving…' : 'Save number'}</button></div><small>Phone numbers can be updated here. SMS verification is not enabled yet.</small></form>
              <p className="member-school-managed-note">Your name, username, and role are managed by your school and cannot be changed here.</p>
            </section>
            <section className="member-panel member-security-panel"><div className="member-panel-title"><div><p className="member-kicker">SECURITY</p><h3>Change your password</h3></div></div>
              <form className="member-password-form" onSubmit={changePassword}><label htmlFor="member-current-password">Current password<input id="member-current-password" autoComplete="current-password" required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label htmlFor="member-new-password">New password<input id="member-new-password" autoComplete="new-password" minLength={8} maxLength={20} required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label htmlFor="member-confirm-password">Confirm new password<input id="member-confirm-password" autoComplete="new-password" minLength={8} maxLength={20} required type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label><div><small>Use 8 to 20 characters. Your current password is required.</small><button className="member-primary-action" disabled={busy || !currentPassword || !newPassword || !passwordConfirmation} type="submit">{busy ? 'Updating…' : 'Update password'}</button></div></form>
            </section>
          </div>

          <aside className="member-profile-side">
            <section className="member-panel member-avatar-panel"><div className="member-panel-title"><div><p className="member-kicker">YOUR PORTRAIT</p><h3>Choose an avatar</h3></div></div><div className="member-avatar-preview">{avatar(appearanceDraft, 'member-avatar-large')}<span><strong>{appearanceDraft.avatarType === 'PHOTO' ? 'Your photo' : appearanceDraft.avatarType === 'ANIMAL' ? (() => { const animal = selectedAnimal(appearanceDraft); return animal ? `${animal.name} · ${animal.age === 'adult' ? 'Adult' : 'Student'}` : 'Animal portrait' })() : 'Your initials'}</strong><small>Choose any portrait, for adults or students.</small></span></div>
              <div className="member-avatar-actions"><button className={appearanceDraft.avatarType === 'INITIALS' ? 'is-selected' : ''} onClick={() => setAppearanceDraft({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })} type="button">Use initials</button><label className="member-upload-action">Upload a photo<input accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} type="file" /></label></div>
              <fieldset className="member-animal-picker"><legend>Animal portraits · Adults</legend><div>{animals.filter((animal) => animal.age === 'adult').map((animal) => <button aria-label={`${animal.name}, adult`} aria-pressed={appearanceDraft.animal === animal.id} className={appearanceDraft.animal === animal.id ? 'is-selected' : ''} key={animal.id} onClick={() => setAppearanceDraft({ avatarType: 'ANIMAL', animal: animal.id, imageDataUrl: null })} title={`${animal.name} · Adult`} type="button"><span className="member-animal-art" style={animalStyle(animal)} /><small>{animal.name}</small></button>)}</div></fieldset>
              <fieldset className="member-animal-picker"><legend>Animal portraits · Students</legend><div>{animals.filter((animal) => animal.age === 'student').map((animal) => <button aria-label={`${animal.name}, student`} aria-pressed={appearanceDraft.animal === animal.id} className={appearanceDraft.animal === animal.id ? 'is-selected' : ''} key={animal.id} onClick={() => setAppearanceDraft({ avatarType: 'ANIMAL', animal: animal.id, imageDataUrl: null })} title={`${animal.name} · Student`} type="button"><span className="member-animal-art" style={animalStyle(animal)} /><small>{animal.name}</small></button>)}</div></fieldset>
              <button className="member-primary-action member-save-avatar" disabled={busy || appearanceLoading || JSON.stringify(appearance) === JSON.stringify(appearanceDraft)} onClick={() => void saveAppearance()} type="button">{appearanceLoading ? 'Loading…' : busy ? 'Saving…' : 'Save profile picture'}</button>
            </section>
          </aside>
        </div>
      </section>}
    </div>

    <footer className="member-footer"><strong>ClassBridge</strong><span>•</span><span>A more connected school community.</span></footer>

    {errorToast && <div className="member-error-toast" role="alert"><img src="/images/beaver-sad-v2.png" alt="" /><span><strong>Something went wrong</strong><small>{errorToast}</small></span><button aria-label="Dismiss error" onClick={() => setErrorToast('')} type="button">×</button></div>}
    {confirmSignOut && <div className="member-modal-backdrop" role="presentation"><section className="member-confirm-card" aria-labelledby="member-signout-title" aria-modal="true" role="dialog"><img src="/images/beaver-confused-v2.png" alt="ClassBridge beaver mascot looking unsure" /><div><p className="member-kicker">BEFORE YOU GO</p><h2 id="member-signout-title">Ready to leave?</h2><p>Are you sure you want to sign out of your account?</p><div><button className="member-secondary-action" onClick={() => setConfirmSignOut(false)} type="button">Stay here</button><button className="member-primary-action" onClick={onSignOut} type="button">Sign out</button></div></div></section></div>}
  </main>
}
