import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ThemeMode } from './LoginExperience'
import { fetchCached } from './apiClient'
import CampusMemberWorkspace from './CampusMemberWorkspace'
import StudentWorkspace, { type ParentChild } from './StudentWorkspace'
import SchoolSuppliesPattern from './SchoolSuppliesPattern'
import WorkspaceTransition from './WorkspaceTransition'
import './ParentWorkspace.css'

type Profile = { userAccountId: number; username: string; role: 'PARENT'; firstName: string | null; lastName: string | null; email?: string | null; emailVerified?: boolean; phoneNumber?: string | null }
type Appearance = { avatarType: 'INITIALS' | 'ANIMAL' | 'PHOTO'; animal: string | null; imageDataUrl: string | null }
type Props = { theme: ThemeMode; token: string; profile: Profile; onToggleTheme: () => void; onSignOut: () => void; onSessionExpired: () => void }
type ParentRoute = { view: 'home' | 'profile' | 'child'; childId?: number }

function readRoute(): ParentRoute {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/')
  if (parts[0] !== 'campus' || parts[1] !== 'parent') return { view: 'home' }
  if (parts[2] === 'profile') return { view: 'profile' }
  if (parts[2] === 'children' && Number(parts[3]) > 0) return { view: 'child', childId: Number(parts[3]) }
  return { view: 'home' }
}

function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CB' }
function animalStyle(value: string | null) {
  if (!value) return undefined
  const [species = '', group = 'ADULT'] = value.split('_')
  const names = ['LION', 'BEAR', 'KOALA', 'TURTLE', 'OWL', 'HIPPO', 'SNAKE', 'FOX', 'RABBIT', 'OTTER', 'CHEETAH']
  const index = names.indexOf(species)
  if (index < 0) return undefined
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url('/images/profile-animals-${group === 'STUDENT' ? 'students' : 'adults'}.jpg')`,
    backgroundSize: '400% 400%',
    backgroundPosition: `${((index % 4) / 3) * 100}% ${['0%', '44.44%', '88.89%'][row] ?? '0%'}`,
  }
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const response = await fetchCached(path, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } })
  if (!response.ok) {
    if (response.status === 401) throw Object.assign(new Error('Your session has expired. Please sign in again.'), { status: 401 })
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message || 'This information could not be loaded. Please try again.')
  }
  return await response.json() as T
}

export default function ParentWorkspace({ theme, token, profile, onToggleTheme, onSignOut, onSessionExpired }: Props) {
  const [accountProfile, setAccountProfile] = useState(profile)
  const [route, setRoute] = useState<ParentRoute>(readRoute)
  const [children, setChildren] = useState<ParentChild[]>([])
  const [childrenLoaded, setChildrenLoaded] = useState(false)
  const [appearance, setAppearance] = useState<Appearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceLoaded, setAppearanceLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [confirmParentReturn, setConfirmParentReturn] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const routeRef = useRef(route)
  useEffect(() => { routeRef.current = route }, [route])
  const fullName = useMemo(() => [accountProfile.firstName, accountProfile.lastName].filter(Boolean).join(' ') || accountProfile.username, [accountProfile.firstName, accountProfile.lastName, accountProfile.username])
  const greeting = profile.firstName || 'there'
  const selectedChild = children.find((child) => child.studentProfileId === route.childId) ?? null

  useEffect(() => {
    const sync = () => {
      const next = readRoute()
      const current = routeRef.current
      setError('')
      if (current.view === 'child' && next.view === 'child' && current.childId === next.childId) { setConfirmParentReturn(false); return }
      if (current.view === 'child' && current.childId && next.view === 'home') {
        window.history.pushState({ parentReturnGuard: true }, '', `#campus/parent/children/${current.childId}`)
        setConfirmParentReturn(true)
        return
      }
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
      setTransitioning(true)
      transitionTimer.current = window.setTimeout(() => { routeRef.current = next; setRoute(next); setTransitioning(false); transitionTimer.current = null }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700)
    }
    window.addEventListener('popstate', sync)
    return () => { window.removeEventListener('popstate', sync); if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current) }
  }, [])

  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setConfirmSignOut(false); setProfileOpen(false) } }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [])
  useEffect(() => { const outside = (event: PointerEvent) => { if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false) }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside) }, [])

  useEffect(() => {
    let active = true
    const shouldLoadChildren = !childrenLoaded && (route.view === 'home' || route.view === 'child')
    if (!shouldLoadChildren) {
      if (route.childId && !children.some((child) => child.studentProfileId === route.childId)) {
        setError('That child is no longer linked to this account.')
        window.history.replaceState(window.history.state, '', '#campus/parent')
        routeRef.current = { view: 'home' }
        setRoute({ view: 'home' })
      }
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    getJson<ParentChild[]>('/api/parent/children', token)
      .then((linkedChildren) => {
        if (!active) return
        setChildren(linkedChildren ?? [])
        setChildrenLoaded(true)
        if (route.childId && !linkedChildren.some((child) => child.studentProfileId === route.childId)) {
          setError('That child is no longer linked to this account.')
          window.history.replaceState(window.history.state, '', '#campus/parent')
          routeRef.current = { view: 'home' }
          setRoute({ view: 'home' })
        }
      })
      .catch((loadError: unknown) => {
        if (!active) return
        if (loadError && typeof loadError === 'object' && 'status' in loadError && loadError.status === 401) { onSessionExpired(); return }
        setError(loadError instanceof Error ? loadError.message : 'This information could not be loaded. Please try again.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, route.view, route.childId, childrenLoaded, children, onSessionExpired])

  useEffect(() => {
    let active = true
    getJson<Appearance>('/api/auth/appearance', token)
      .then((savedAppearance) => { if (active) { setAppearance(savedAppearance); setAppearanceLoaded(true) } })
      .catch((appearanceError: unknown) => {
        if (!active) return
        if (appearanceError && typeof appearanceError === 'object' && 'status' in appearanceError && appearanceError.status === 401) onSessionExpired()
      })
    return () => { active = false }
  }, [token, onSessionExpired])

  function navigate(next: ParentRoute) {
    const hash = next.view === 'profile' ? '#campus/parent/profile'
      : next.view === 'child' && next.childId ? `#campus/parent/children/${next.childId}`
        : '#campus/parent'
    if (window.location.hash !== hash) window.history.pushState({}, '', hash)
    setError('')
    setProfileOpen(false)
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    setTransitioning(true)
    transitionTimer.current = window.setTimeout(() => { routeRef.current = next; setRoute(next); setTransitioning(false); transitionTimer.current = null }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const returnToParentHome = useCallback(() => {
    if (window.history.state?.parentReturnGuard) window.history.replaceState({}, '', '#campus/parent')
    else if (window.location.hash !== '#campus/parent') window.history.pushState({}, '', '#campus/parent')
    setConfirmParentReturn(false)
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    setTransitioning(true)
    transitionTimer.current = window.setTimeout(() => { const home = { view: 'home' } as const; routeRef.current = home; setRoute(home); setTransitioning(false); transitionTimer.current = null }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const parentChildView = useMemo(() => selectedChild ? {
    child: selectedChild,
    confirmReturn: confirmParentReturn,
    onCancelReturn: () => setConfirmParentReturn(false),
    onReturnToParent: returnToParentHome,
  } : undefined, [selectedChild, confirmParentReturn, returnToParentHome])

  function renderAvatar() {
    const art = animalStyle(appearance.animal)
    return <span className={`parent-avatar avatar-${appearance.avatarType.toLowerCase()}`} aria-label={`${fullName} profile picture`}>
      {appearance.avatarType === 'PHOTO' && appearance.imageDataUrl ? <img src={appearance.imageDataUrl} alt="" />
        : appearance.avatarType === 'ANIMAL' && art ? <span style={art} />
          : initials(fullName)}
    </span>
  }

  if (route.view === 'child') {
    if (loading) return <main className={'parent-workspace' + (theme === 'dark' ? ' is-dark' : '')}><div className="parent-loading">Opening your child’s school space…</div></main>
    if (selectedChild && parentChildView) return <><StudentWorkspace key={selectedChild.studentProfileId} theme={theme} token={token} profile={accountProfile} onToggleTheme={onToggleTheme} onSignOut={onSignOut} onSessionExpired={onSessionExpired} parentView={parentChildView} />{transitioning && <WorkspaceTransition tone="parent" dark={theme === 'dark'} />}</>
    return <main className={'parent-workspace' + (theme === 'dark' ? ' is-dark' : '')}><section className="parent-content"><button className="parent-back-link" onClick={returnToParentHome} type="button">← Back to your children</button><p className="parent-load-error" role="alert">{error || 'This child is not available.'}</p></section></main>
  }

  return <main className={'parent-workspace' + (theme === 'dark' ? ' is-dark' : '')}>
    <header className="parent-topbar">
      <button className="parent-brand" onClick={() => navigate({ view: 'home' })} type="button" aria-label="ClassBridge parent home"><img src="/images/classbridge-bridge-logo.png" alt="ClassBridge" /></button>
      <nav className="parent-nav" aria-label="Parent workspace"><button className={route.view === 'home' ? 'is-active' : ''} onClick={() => navigate({ view: 'home' })} type="button" aria-current={route.view === 'home' ? 'page' : undefined}>My children</button><button className={route.view === 'profile' ? 'is-active' : ''} onClick={() => navigate({ view: 'profile' })} type="button" aria-current={route.view === 'profile' ? 'page' : undefined}>My profile</button></nav>
      <div className="parent-top-actions"><button className="parent-theme-button" onClick={onToggleTheme} type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M2 12h2m16 0h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.2 8.2 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z"/></svg>}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button><div className="parent-profile-menu" ref={profileMenuRef}><button className="parent-account-button" onClick={() => setProfileOpen((open) => !open)} type="button" aria-expanded={profileOpen} aria-haspopup="menu">{renderAvatar()}<span>{fullName}</span><b>⌄</b></button>{profileOpen && <div className="parent-profile-dropdown" role="menu"><div className="parent-dropdown-person">{renderAvatar()}<strong>{fullName}</strong><small>{accountProfile.email || accountProfile.username}</small><small>Parent account</small></div><button role="menuitem" onClick={() => navigate({ view: 'profile' })} type="button">My profile <span>Account settings</span></button><button className="parent-dropdown-signout" role="menuitem" onClick={() => { setProfileOpen(false); setConfirmSignOut(true) }} type="button">Sign out</button></div>}</div></div>
    </header>

    {route.view === 'profile' ? <div className="parent-content parent-profile-content"><CampusMemberWorkspace embedded theme={theme} token={token} profile={accountProfile} onToggleTheme={onToggleTheme} onSignOut={onSignOut} onSessionExpired={onSessionExpired} onAppearanceChange={setAppearance} onProfileChange={(updates) => setAccountProfile((current) => ({ ...current, ...updates }))} initialAppearance={appearanceLoaded ? appearance : undefined} onReturnHome={() => navigate({ view: 'home' })} /></div> : <div className="parent-content">
      <section className="parent-welcome"><div className="parent-welcome-art"><img src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /></div><div><p className="parent-kicker">YOUR FAMILY’S SCHOOL CONNECTION</p><h1>Welcome, {greeting}.</h1><p>Choose a child to open their school space and stay up to date.</p></div><SchoolSuppliesPattern className="parent-welcome-supplies" /></section>
      <section className="parent-children-section"><div className="parent-section-heading"><div><p className="parent-kicker">YOUR FAMILY</p><h2>Your children</h2><p>Each child opens their own school view.</p></div><span className="parent-children-count">{children.length} {children.length === 1 ? 'child' : 'children'}</span></div>
        {error && <p className="parent-load-error" role="alert">{error}</p>}
        {loading ? <div className="parent-empty-state">Loading your linked children…</div> : children.length === 0 ? <div className="parent-empty-state"><span className="parent-empty-mark" aria-hidden="true">⌂</span><h3>No linked children yet</h3><p>When your school links a student to your parent account, they’ll appear here.</p></div> : <div className="parent-child-grid">{children.map((child, index) => {
          const childName = [child.firstName, child.lastName].filter(Boolean).join(' ') || 'Student'
          const grade = child.gradeLevel && child.sectionName ? `Grade ${child.gradeLevel} · ${child.sectionName}` : child.educationLevel.replaceAll('_', ' ').toLocaleLowerCase('en-US')
          return <button className="parent-child-card" key={child.studentProfileId} onClick={() => navigate({ view: 'child', childId: child.studentProfileId })} type="button"><span className={'parent-child-mark mark-' + (index % 4)}>{initials(childName)}</span><span className="parent-child-copy"><small>STUDENT ACCOUNT</small><strong>{childName}</strong><em>{grade}</em><span>{child.schoolName}</span></span><span className="parent-child-open">Open school space <b>→</b></span></button>
        })}</div>}
      </section>
    </div>}

    <footer className="parent-footer"><strong>ClassBridge</strong><span>•</span><span>A more connected school community</span></footer>
    {transitioning && <WorkspaceTransition tone="parent" dark={theme === 'dark'} />}
    {confirmSignOut && <div className="parent-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSignOut(false) }} role="presentation"><section className="parent-signout-modal" role="dialog" aria-modal="true" aria-labelledby="parent-signout-title"><img src="/images/beaver-signout-cutout.png" alt="ClassBridge beaver looks unsure about leaving"/><p className="parent-kicker">BEFORE YOU HEAD OUT</p><h2 id="parent-signout-title">Ready to leave, {greeting}?</h2><p>You can come back to your family space whenever you’re ready.</p><div><button onClick={() => setConfirmSignOut(false)} type="button">Stay here</button><button onClick={onSignOut} type="button">Sign out</button></div></section></div>}
  </main>
}
