import { useState, type FormEvent } from 'react'
import './LoginExperience.css'

export type EntryPortal = 'campus' | 'management'
export type CampusRole = 'PARENT' | 'STUDENT' | 'TEACHER'
export type ThemeMode = 'light' | 'dark'

type Props = {
  portal: EntryPortal | null
  selectedRole: CampusRole | null
  theme: ThemeMode
  isSigningIn: boolean
  loginError: string
  sessionMessage: string
  onChoosePortal: (portal: EntryPortal) => void
  onChooseRole: (role: CampusRole) => void
  onBack: () => void
  onToggleTheme: () => void
  onSignIn: (username: string, password: string) => void
}

const roleContent: Record<CampusRole, { title: string; shortTitle: string; description: string; color: string }> = {
  PARENT: {
    title: 'Stay close to your child’s school life.',
    shortTitle: 'Parent',
    description: 'Keep up with school announcements and conversations in one place.',
    color: 'parent',
  },
  STUDENT: {
    title: 'Your school day, all in one place.',
    shortTitle: 'Student',
    description: 'Follow announcements and conversations from your school.',
    color: 'student',
  },
  TEACHER: {
    title: 'Stay connected to your class and school.',
    shortTitle: 'Teacher',
    description: 'Share announcements and stay in touch with your school community.',
    color: 'teacher',
  },
}

function Brand() {
  return (
    <a className="entry-brand" href="/" aria-label="ClassBridge home">
      <span className="entry-brand-art">
        <img src="/images/classbridge-bridge-logo.png" alt="" />
      </span>
    </a>
  )
}

function ThemeButton({ theme, onClick }: { theme: ThemeMode; onClick: () => void }) {
  const isDark = theme === 'dark'
  return (
    <button
      className="entry-theme-button"
      type="button"
      onClick={onClick}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.2 8.2 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></svg>
      )}
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}

function Icon({ kind }: { kind: 'building' | 'campus' | 'parent' | 'student' | 'teacher' }) {
  const paths = {
    building: <><path d="M4 21V6.5L12 3l8 3.5V21" /><path d="M2 21h20M8 8v2m8-2v2M8 13v2m8-2v2M10 21v-4h4v4" /></>,
    campus: <><path d="m3 9 9-5 9 5-9 5-9-5Z" /><path d="M6 11v5c3.7 3 8.3 3 12 0v-5M21 9v6" /></>,
    parent: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8m2 3.2a5 5 0 0 1 2.5 4.3V20" /></>,
    student: <><path d="m3 9 9-5 9 5-9 5-9-5Z" /><path d="M6 11v5c3.7 3 8.3 3 12 0v-5M21 9v6" /></>,
    teacher: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M4 6h12m-8 4h8m-8 4h5" /></>,
  }
  return <svg className="entry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>
}

type BeaverMood = 'guide' | 'sad' | 'confused' | 'asking'

function BeaverGuide({ mood, size = 'small' }: { mood: BeaverMood; size?: 'small' | 'hero' | 'compact' }) {
  const moodContent: Record<BeaverMood, { image: string; alt: string }> = {
    guide: { image: 'beaver-guide.jpg', alt: 'The ClassBridge beaver mascot smiling and guiding you' },
    sad: { image: 'beaver-sad.jpg', alt: 'The ClassBridge beaver mascot looks sad and ready to help' },
    confused: { image: 'beaver-confused.jpg', alt: 'The ClassBridge beaver mascot looks confused and lost' },
    asking: { image: 'beaver-asking.jpg', alt: 'The ClassBridge beaver mascot asking a question' },
  }
  const content = moodContent[mood]
  return (
    <div className={`beaver-guide beaver-guide-${size}`}>
      <img src={`/images/${content.image}`} alt={content.alt} />
    </div>
  )
}

function StoryPanel({ portal, role }: { portal: EntryPortal | null; role: CampusRole | null }) {
  const content = role ? roleContent[role] : null
  const management = portal === 'management'
  const home = portal === null && role === null
  const scene = role
    ? `${role.toLocaleLowerCase('en-US')}-scene.jpg`
    : portal === null ? 'forest-school-scene.jpg' : 'community-scene.jpg'
  return (
    <aside className={`entry-story-panel ${content ? `story-${content.color}` : management ? 'story-management' : 'story-home'}`}>
      <img className="story-scene-image" src={`/images/${scene}`} alt="" />
      <div className="story-scene-wash" aria-hidden="true" />
      <div className="story-copy-block">
        <p className="entry-kicker">{role ? `${content?.shortTitle.toLocaleUpperCase('en-US')} PORTAL` : management ? 'MANAGEMENT PORTAL' : 'CLASSBRIDGE'}</p>
        <h1>{content?.title ?? (management ? 'Bring your school community together.' : 'A trusted bridge between school and home.')}</h1>
        {!home && <p className="story-description">
          {content?.description ?? (management
            ? 'Announcements, classrooms, and communication in one workspace for school administrators.'
            : 'A shared space for students, families, and educators to stay connected.')}
        </p>}
      </div>
      {!home && <p className="story-footer-note">A more connected school community.</p>}
    </aside>
  )
}

export default function LoginExperience({
  portal,
  selectedRole,
  theme,
  isSigningIn,
  loginError,
  sessionMessage,
  onChoosePortal,
  onChooseRole,
  onBack,
  onToggleTheme,
  onSignIn,
}: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const isLogin = portal === 'management' || selectedRole !== null
  const role = selectedRole
  const roleInfo = role ? roleContent[role] : null
  const loginTitle = roleInfo?.shortTitle ?? 'Administrator'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSignIn(username.trim(), password)
  }

  return (
    <main className={`entry-page${portal === null ? ' entry-page-home' : ''}`}>
      <header className="entry-header">
        <Brand />
        <div className="entry-header-actions">
          {portal && <button className="entry-back-link" type="button" onClick={onBack}>← <span>Geri</span></button>}
          {portal && <ThemeButton theme={theme} onClick={onToggleTheme} />}
        </div>
      </header>

      {!portal ? (
        <section className="entry-layout entry-layout-home">
          <StoryPanel portal={null} role={null} />
          <div className="entry-content-panel entry-home-panel">
            <BeaverGuide mood="guide" size="hero" />
              <p className="entry-kicker">CHOOSE YOUR PORTAL</p>
              <h2>Welcome to ClassBridge.</h2>
              <p className="entry-panel-intro">Select your portal to continue.</p>
            <div className="portal-options">
              <button className="portal-option portal-option-management" type="button" onClick={() => onChoosePortal('management')}>
                <span className="option-icon option-icon-art"><img src="/images/portal-management.png" alt="" /></span>
                  <span className="option-copy"><span className="option-index">01 / MANAGEMENT</span><strong>Management portal</strong><span>For school and platform administrators</span></span>
                <span className="option-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="portal-option portal-option-campus" type="button" onClick={() => onChoosePortal('campus')}>
                <span className="option-icon option-icon-art"><img src="/images/portal-campus.png" alt="" /></span>
                  <span className="option-copy"><span className="option-index">02 / SCHOOL</span><strong>School portal</strong><span>For parents, students, and teachers</span></span>
                <span className="option-arrow" aria-hidden="true">↗</span>
              </button>
            </div>
              <p className="entry-assurance">Your account access is managed securely.</p>
          </div>
        </section>
      ) : !isLogin ? (
        <section className="entry-layout entry-layout-roles">
          <StoryPanel portal="campus" role={null} />
          <div className="entry-content-panel">
            <BeaverGuide mood="asking" />
            <p className="entry-kicker">SCHOOL PORTAL</p>
            <h2>Which role are you signing in as?</h2>
            <p className="entry-panel-intro">Choose the sign-in that fits your role.</p>
            <div className="role-options">
              {(['PARENT', 'STUDENT', 'TEACHER'] as const).map((campusRole, index) => {
                const item = roleContent[campusRole]
                const iconKind = campusRole === 'PARENT' ? 'parent' : campusRole === 'STUDENT' ? 'student' : 'teacher'
                return (
                  <button className={`role-option role-option-${item.color}`} key={campusRole} type="button" onClick={() => onChooseRole(campusRole)}>
                    <span className="role-option-index">0{index + 1}</span>
                    <span className="role-option-icon"><Icon kind={iconKind} /></span>
                    <span className="role-option-copy"><strong>{item.shortTitle}</strong><span>{campusRole === 'PARENT' ? 'Keep up with your child’s school life' : campusRole === 'STUDENT' ? 'View announcements and conversations' : 'Connect with your class and school'}</span></span>
                    <span className="option-arrow" aria-hidden="true">→</span>
                  </button>
                )
              })}
            </div>
            <button className="entry-return-link" type="button" onClick={onBack}>← Back to portal selection</button>
          </div>
        </section>
      ) : (
        <section className="entry-layout entry-layout-login">
          <StoryPanel portal={portal} role={role} />
          <div className="entry-content-panel entry-login-panel">
            <div className="login-card-heading">
              <p className="entry-kicker">{portal === 'management' ? 'MANAGEMENT' : 'SCHOOL'} · SIGN IN</p>
              <h2 id="login-heading">{loginTitle} sign in</h2>
              <p>Enter your account details to continue.</p>
            </div>
            {sessionMessage && <div className="entry-notice" role="status">{sessionMessage}</div>}
            <form className="entry-login-form" onSubmit={submit}>
              <label htmlFor="entry-username">Username</label>
              <input
                id="entry-username"
                autoComplete="username"
                autoFocus
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                required
                value={username}
              />
              <label htmlFor="entry-password">Password</label>
              <input
                id="entry-password"
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
              {loginError && (
                <div className="entry-error-row" role="alert">
                  <BeaverGuide mood={loginError.includes('selected portal') ? 'confused' : 'sad'} size="compact" />
                  <p className="entry-error">{loginError}</p>
                </div>
              )}
              <button className="entry-submit" disabled={isSigningIn} type="submit">
                {isSigningIn ? <><span className="entry-spinner" /> Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}
              </button>
            </form>
            <p className="entry-help">Need help accessing your account? <span>Contact your school administrator.</span></p>
          </div>
        </section>
      )}

      <footer className="entry-page-footer"><span>ClassBridge</span><i aria-hidden="true" /> A more connected school community.</footer>
    </main>
  )
}
