import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import AnnouncementsPanel from './AnnouncementsPanel'
import type { ThemeMode } from './LoginExperience'
import { fetchCached } from './apiClient'
import './CampusMemberWorkspace.css'

type Role = 'PARENT' | 'STUDENT'
type Profile = { userAccountId: number; username: string; role: Role; firstName: string | null; lastName: string | null; email?: string | null; emailVerified?: boolean; phoneNumber?: string | null }
type AvatarType = 'INITIALS' | 'ANIMAL' | 'PHOTO'
type Appearance = { avatarType: AvatarType; animal: string | null; imageDataUrl: string | null }
type View = 'today' | 'announcements' | 'profile'
type ContactUpdate = Pick<Profile, 'email' | 'emailVerified' | 'phoneNumber'>
type Props = { theme: ThemeMode; token: string; profile: Profile; onToggleTheme: () => void; onSignOut: () => void; onSessionExpired: () => void; onAppearanceChange?: (appearance: Appearance) => void; onProfileChange?: (profile: ContactUpdate) => void; initialAppearance?: Appearance; onReturnHome?: () => void; onOpenMessages?: () => void; onOpenAnnouncements?: () => void; embedded?: boolean }

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
    backgroundPosition: `${(animal.column / 3) * 100}% ${['0%', '44.44%', '88.89%'][animal.row] ?? '0%'}`,
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
  const response = await fetchCached(path, { ...init, headers })
  const text = await response.text()
  let body: { message?: string } | null = null
  if (text) { try { body = JSON.parse(text) as { message?: string } } catch { body = null } }
  if (!response.ok) throw new ApiError(body?.message || `The request could not be completed (${response.status}).`, response.status)
  return (text ? body : null) as T
}

export default function CampusMemberWorkspace({ theme, token, profile, onToggleTheme, onSignOut, onSessionExpired, onAppearanceChange, onProfileChange, initialAppearance, onReturnHome, onOpenMessages, onOpenAnnouncements, embedded = false }: Props) {
  const [view, setView] = useState<View>(readView)
  const [appearance, setAppearance] = useState<Appearance>(() => initialAppearance ?? { avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceDraft, setAppearanceDraft] = useState<Appearance>(() => initialAppearance ?? { avatarType: 'INITIALS', animal: null, imageDataUrl: null })
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
  const [errorToast, setErrorToast] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [appearanceLoading, setAppearanceLoading] = useState(true)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | null>(null)
  const successToastTimer = useRef<number | null>(null)
  const fullName = useMemo(() => [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username, [profile.firstName, profile.lastName, profile.username])
  const greetingName = profile.firstName || profile.username
  const selectedAnimal = (value: Appearance) => animals.find((animal) => animal.id === value.animal)

  const notifyError = useCallback((message: string) => {
    setErrorToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current)
    successToastTimer.current = null
    setSuccessToast('')
    toastTimer.current = window.setTimeout(() => { setErrorToast(''); toastTimer.current = null }, 7000)
  }, [])

  const notifySuccess = useCallback((message: string) => {
    setSuccessToast(message)
    if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = null
    setErrorToast('')
    successToastTimer.current = window.setTimeout(() => { setSuccessToast(''); successToastTimer.current = null }, 4000)
  }, [])

  const dismissErrorToast = useCallback(() => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = null
    setErrorToast('')
  }, [])

  const dismissSuccessToast = useCallback(() => {
    if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current)
    successToastTimer.current = null
    setSuccessToast('')
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
    if (initialAppearance) {
      setAppearance(initialAppearance)
      setAppearanceDraft(initialAppearance)
      onAppearanceChange?.(initialAppearance)
      setAppearanceLoading(false)
      return
    }
    let active = true
    api<Appearance>('/api/auth/appearance', token)
      .then((value) => { if (active && value) { setAppearance(value); setAppearanceDraft(value); onAppearanceChange?.(value) } })
      .catch((error) => { if (active) handleApiError(error) })
      .finally(() => { if (active) setAppearanceLoading(false) })
    return () => { active = false }
  }, [handleApiError, initialAppearance, onAppearanceChange, token])

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current)
  }, [])

  function navigate(next: View) {
    setProfileMenuOpen(false)
    const hash = viewHash(next, profile.role)
    if (window.location.hash !== hash) window.history.pushState({}, '', hash)
    setView(next)
  }

  function avatar(value: Appearance, className = '') {
    const animal = selectedAnimal(value)
    return <span className={`member-avatar member-avatar-${value.avatarType.toLowerCase()} ${className}`} aria-hidden="true">
      {value.avatarType === 'PHOTO' && value.imageDataUrl ? <img src={value.imageDataUrl} alt="" /> : value.avatarType === 'ANIMAL' && animal ? <span className="member-animal-art" style={animalStyle(animal)} /> : initials(fullName)}
    </span>
  }

  async function saveAppearance() {
    setBusy(true)
    try {
      const saved = await api<Appearance>('/api/auth/appearance', token, { method: 'PUT', body: JSON.stringify(appearanceDraft) })
      if (saved) { setAppearance(saved); setAppearanceDraft(saved); onAppearanceChange?.(saved) }
      notifySuccess('Your profile picture has been saved.')
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
    if (next.toLocaleLowerCase() === savedEmail.trim().toLocaleLowerCase()) { notifySuccess('This email address is already saved.'); return }
    setBusy(true)
    try {
      await api('/api/auth/email', token, { method: 'PUT', body: JSON.stringify({ email: next }) })
      setSavedEmail(next); setEmailVerified(false); setVerificationSent(false); setVerificationCode('')
      onProfileChange?.({ email: next, emailVerified: false })
      notifySuccess('Email saved. Verify it before using it for password recovery.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  async function sendVerificationCode() {
    setBusy(true)
    try {
      await api('/api/auth/email-verification/request', token, { method: 'POST' })
      setVerificationSent(true); notifySuccess('A six-digit code has been sent to your email.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  async function confirmVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    try {
      await api('/api/auth/email-verification/confirm', token, { method: 'POST', body: JSON.stringify({ code: verificationCode }) })
      setEmailVerified(true); setVerificationSent(false); setVerificationCode(''); notifySuccess('Your email address is verified.')
      onProfileChange?.({ email: savedEmail, emailVerified: true })
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  async function savePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    try {
      const updated = await api<Profile>('/api/auth/phone', token, { method: 'PUT', body: JSON.stringify({ phoneNumber: phoneDraft.trim() }) })
      setPhoneDraft(updated.phoneNumber || phoneDraft.trim())
      setSavedPhone(updated.phoneNumber || phoneDraft.trim())
      onProfileChange?.({ email: updated.email, emailVerified: updated.emailVerified, phoneNumber: updated.phoneNumber })
      notifySuccess('Your phone number has been updated.')
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword.length < 8 || newPassword.length > 20) { notifyError('Your new password must be 8 to 20 characters long.'); return }
    if (newPassword !== passwordConfirmation) { notifyError('The new password and confirmation do not match.'); return }
    setBusy(true)
    try {
      await api('/api/auth/change-password', token, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
      setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation(''); onSessionExpired()
    } catch (error) { handleApiError(error) }
    finally { setBusy(false) }
  }

  return <main className={'member-workspace' + (embedded ? ' member-workspace-embedded' : '')}>
    {!embedded && <header className="member-topbar">
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
    </header>}

    <div className={'member-content' + (embedded ? ' member-content-embedded' : '')}>
      {!embedded && <section className="member-welcome">
        <div className="member-welcome-mascot" title="Your ClassBridge guide"><img className="member-mascot-rest" src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><img className="member-mascot-wave" src="/images/beaver-guide-wave.png" alt="" /></div>
        <div><p className="member-kicker">YOUR SCHOOL COMMUNITY · {profile.role === 'PARENT' ? 'PARENT' : 'STUDENT'}</p><h1>Good day, {greetingName}.</h1><p>School updates and your account, together in one place.</p></div>
      </section>}

      {!embedded && view === 'today' && <section className="member-shortcuts" aria-label="Your workspace">
        <button onClick={() => navigate('announcements')} type="button"><span className="member-shortcut-mark river">↗</span><span><small>THE SCHOOL NOTICEBOARD</small><strong>School updates</strong><em>Read announcements shared by your school.</em></span><b>→</b></button>
        <button onClick={() => navigate('profile')} type="button"><span className="member-shortcut-mark wood">⌂</span><span><small>YOUR ACCOUNT</small><strong>Profile and settings</strong><em>Update your contact details and profile picture.</em></span><b>→</b></button>
      </section>}

      {view === 'announcements' && <AnnouncementsPanel token={token} role={profile.role} />}

      {view === 'profile' && <section className="member-profile-page">
        {embedded && <button className="member-back-link" onClick={() => onReturnHome ? onReturnHome() : navigate('today')} type="button">← Back to today</button>}
        <div className="member-profile-heading"><div>{avatar(appearance, 'member-profile-hero-avatar')}<div><p className="member-kicker">YOUR CLASSBRIDGE ACCOUNT</p><h1>My profile</h1><p>Keep your account details and portrait up to date.</p></div></div><span className="member-role-chip">{profile.role === 'PARENT' ? 'Parent' : 'Student'}</span></div>
        <div className="member-profile-layout">
          <div className="member-profile-main">
            <section className="member-panel member-account-panel"><div className="member-profile-panel-heading"><div><p className="member-kicker">ACCOUNT DETAILS</p><h2>Your information</h2></div><span className="member-readonly-mark">School managed</span></div>
              <div className="member-profile-facts"><div><small>FULL NAME</small><strong>{fullName}</strong></div><div><small>USERNAME</small><strong>{profile.username}</strong></div><div><small>ROLE</small><strong>{profile.role === 'PARENT' ? 'Parent' : 'Student'}</strong></div></div>
              <p className="member-school-managed-note">Your name, username, and role are managed by your school and cannot be changed here.</p>
            </section>

            <section className="member-panel member-contact-panel"><div className="member-profile-panel-heading"><div><p className="member-kicker">CONTACT DETAILS</p><h2>Ways to reach you</h2></div></div>
              <form className="member-profile-field-form" onSubmit={(event) => { event.preventDefault(); void saveEmail() }}><label htmlFor="member-email">Email address <span className={'member-email-status' + (emailVerified ? ' is-verified' : '')}>{emailVerified ? 'Verified' : 'Not verified'}</span></label><div className="member-profile-inline-field"><input id="member-email" autoComplete="email" type="email" maxLength={254} value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="you@example.com" /><button className={'member-primary-action member-contact-action' + (busy ? ' is-busy' : '')} type="submit" disabled={busy || !emailDraft.trim()}>{busy ? 'Saving…' : 'Save email'}</button></div></form>
              {!emailVerified && <p className="member-verify-state">{savedEmail ? 'This email must be verified before password recovery.' : 'Add and verify an email address for password recovery.'}</p>}
              {savedEmail && !emailVerified && <div className="member-verification-actions">{!verificationSent ? <button className={'member-text-action' + (busy ? ' is-busy' : '')} disabled={busy} onClick={() => void sendVerificationCode()} type="button">{verificationSent ? 'Send a new code' : 'Send verification code'} <span>→</span></button> : <form className="member-profile-inline-field member-code-form" onSubmit={confirmVerification}><label className="sr-only" htmlFor="member-verification-code">Six-digit email verification code</label><input id="member-verification-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" /><button className={'member-secondary-action' + (busy ? ' is-busy' : '')} disabled={busy || verificationCode.length !== 6} type="submit">{busy ? 'Checking…' : 'Verify email'}</button></form>}</div>}
              <form className="member-profile-field-form" onSubmit={savePhone}><label htmlFor="member-phone">Phone number</label><div className="member-profile-inline-field"><input id="member-phone" autoComplete="tel" maxLength={32} type="tel" value={phoneDraft} onChange={(event) => setPhoneDraft(event.target.value)} placeholder="Add your phone number" /><button className={'member-primary-action member-contact-action' + (busy ? ' is-busy' : '')} type="submit" disabled={busy || !phoneDraft.trim() || phoneDraft.trim() === savedPhone}>{busy ? 'Saving…' : 'Save number'}</button></div></form>
            </section>
            <section className="member-panel member-security-panel"><div className="member-profile-panel-heading"><div><p className="member-kicker">SECURITY</p><h2>Change your password</h2></div></div>
              <form className="member-password-form" onSubmit={changePassword}><label htmlFor="member-current-password">Current password<input id="member-current-password" autoComplete="current-password" required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label htmlFor="member-new-password">New password<input id="member-new-password" autoComplete="new-password" minLength={8} maxLength={20} required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label htmlFor="member-confirm-password">Confirm new password<input id="member-confirm-password" autoComplete="new-password" minLength={8} maxLength={20} required type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label><div><small>Use 8 to 20 characters. Your current password is required.</small><button className={'member-primary-action' + (busy ? ' is-busy' : '')} disabled={busy || !currentPassword || !newPassword || !passwordConfirmation} type="submit">{busy ? 'Updating…' : 'Update password'}</button></div></form>
            </section>
          </div>

          <aside className="member-profile-side">
            <section className="member-panel member-avatar-panel"><div className="member-profile-panel-heading"><div><p className="member-kicker">YOUR PORTRAIT</p><h2>Choose an avatar</h2></div></div><div className="member-avatar-preview">{avatar(appearanceDraft, 'member-avatar-large')}<span><strong>{appearanceDraft.avatarType === 'PHOTO' ? 'Your photo' : appearanceDraft.avatarType === 'ANIMAL' ? (() => { const animal = selectedAnimal(appearanceDraft); return animal ? `${animal.name} · ${animal.age === 'adult' ? 'Adult' : 'Student'}` : 'Animal portrait' })() : 'Your initials'}</strong><small>Choose any portrait, for adults or students.</small></span></div>
              <div className="member-avatar-initial-choice"><button className={'member-avatar-choice' + (appearanceDraft.avatarType === 'INITIALS' ? ' is-selected' : '')} onClick={() => setAppearanceDraft({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })} type="button"><span className="member-avatar-option-initials">{initials(fullName)}</span><strong>Initials</strong></button></div>
              <div className="member-avatar-groups" aria-label="Animal portraits">{(['adult', 'student'] as const).map((group) => <section className="member-avatar-group" key={group}><h3>{group === 'adult' ? 'For adults' : 'For students'}</h3><div role="group" aria-label={group === 'adult' ? 'Adult animal portraits' : 'Student animal portraits'}>{animals.filter((animal) => animal.age === group).map((animal) => <button className={'member-avatar-choice' + (appearanceDraft.avatarType === 'ANIMAL' && appearanceDraft.animal === animal.id ? ' is-selected' : '')} key={animal.id} aria-label={`${animal.name} · ${group === 'adult' ? 'Adult' : 'Student'}`} aria-pressed={appearanceDraft.avatarType === 'ANIMAL' && appearanceDraft.animal === animal.id} title={`${animal.name} · ${group === 'adult' ? 'Adult' : 'Student'}`} onClick={() => setAppearanceDraft({ avatarType: 'ANIMAL', animal: animal.id, imageDataUrl: null })} type="button"><span className="member-avatar-option-animal" style={animalStyle(animal)} /><strong>{animal.name}</strong></button>)}</div></section>)}</div>
              <label className="member-avatar-upload">＋ Upload a photo<input accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} type="file" /></label><small className="member-avatar-hint">JPG, PNG or WebP · up to 2 MB</small><button className={'member-primary-action member-save-avatar' + (busy ? ' is-busy' : '')} disabled={busy || appearanceLoading || JSON.stringify(appearance) === JSON.stringify(appearanceDraft)} onClick={() => void saveAppearance()} type="button">{appearanceLoading ? 'Loading…' : busy ? 'Saving…' : 'Save avatar'}</button>
            </section>
            <section className="member-panel member-profile-shortcuts"><p className="member-kicker">QUICK ACCESS</p>
              {profile.role === 'STUDENT' && onOpenMessages && <button type="button" onClick={onOpenMessages}><span>Messages</span><small>Open your inbox</small><b>↗</b></button>}
              <button type="button" onClick={() => profile.role === 'PARENT' ? (onReturnHome ? onReturnHome() : navigate('today')) : (onOpenAnnouncements ? onOpenAnnouncements() : navigate('announcements'))}><span>{profile.role === 'PARENT' ? 'My children' : 'School updates'}</span><small>{profile.role === 'PARENT' ? 'Return to your family workspace' : 'Read recent announcements'}</small><b>↗</b></button>
              <button className="member-profile-signout-link" type="button" onClick={() => setConfirmSignOut(true)}><span>Sign out</span><small>We’ll ask before ending your session</small><b>→</b></button>
            </section>
          </aside>
        </div>
      </section>}
    </div>

    {!embedded && <footer className="member-footer"><strong>ClassBridge</strong><span>•</span><span>A more connected school community.</span></footer>}

    {errorToast && <div className="member-error-toast" role="alert"><img src="/images/beaver-error-cutout.png" alt="" /><div><strong>Something went wrong</strong><p>{errorToast}</p></div><button aria-label="Dismiss error" onClick={dismissErrorToast} type="button">×</button></div>}
    {successToast && <div className="member-success-toast" role="status" aria-live="polite"><img src="/images/beaver-success-cutout.png" alt="" /><div><strong>All set!</strong><p>{successToast}</p></div><button aria-label="Dismiss success message" onClick={dismissSuccessToast} type="button">×</button></div>}
    {confirmSignOut && <div className="member-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSignOut(false) }} role="presentation"><section className="member-confirm-card member-signout-confirm-card" aria-labelledby="member-signout-title" aria-modal="true" role="dialog"><button className="member-signout-close" onClick={() => setConfirmSignOut(false)} type="button" aria-label="Close">×</button><img src="/images/beaver-signout-cutout.png" alt="ClassBridge beaver looks unsure about leaving" /><p className="member-kicker">BEFORE YOU HEAD OUT</p><h2 id="member-signout-title">Ready to leave?</h2><p>You can come back to your school space whenever you’re ready.</p><div><button className="member-text-action" onClick={() => setConfirmSignOut(false)} type="button">Stay here</button><button className="member-primary-action" onClick={onSignOut} type="button">Sign out</button></div></section></div>}
  </main>
}
