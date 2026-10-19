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

type BeaverMood = 'guide' | 'sad' | 'confused' | 'asking'

function BeaverGuide({ mood, size = 'small' }: { mood: BeaverMood; size?: 'small' | 'hero' | 'compact' }) {
  const moodContent: Record<BeaverMood, { image: string; alt: string }> = {
    guide: { image: 'beaver-guide.jpg', alt: 'The ClassBridge beaver mascot smiling and guiding you' },
    sad: { image: 'beaver-sad-v2.png', alt: 'The ClassBridge beaver mascot looks sad and ready to help' },
    confused: { image: 'beaver-confused-v2.png', alt: 'The ClassBridge beaver mascot looks surprised and lost' },
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
  const hideCampusStoryDetails = portal === 'campus'
  const scene = role === 'PARENT'
    ? 'parent-home-scene-v2.png'
    : role === 'STUDENT'
      ? 'student-campus-scene-v2.png'
    : role === 'TEACHER'
      ? 'teacher-classroom-scene-v2.png'
    : portal === 'campus' ? 'forest-school-scene.jpg'
      : portal === null ? 'campus-river-scene.png' : 'forest-school-scene.jpg'
  const storyVariant = content
    ? `story-${content.color}`
    : management ? 'story-management' : portal === 'campus' ? 'story-campus' : 'story-home'
  return (
    <aside className={`entry-story-panel ${storyVariant}`}>
      <img className="story-scene-image" src={`/images/${scene}`} alt="" />
      <div className="story-scene-wash" aria-hidden="true" />
      <div className="story-copy-block">
        <p className="entry-kicker">{role ? `${content?.shortTitle.toLocaleUpperCase('en-US')} PORTAL` : management ? 'MANAGEMENT PORTAL' : 'CLASSBRIDGE'}</p>
        <h1>{content?.title ?? (management ? 'Bring your school community together.' : 'A trusted bridge between school and home.')}</h1>
        {!home && !hideCampusStoryDetails && <p className="story-description">
          {content?.description ?? (management
            ? 'Announcements, classrooms, and communication in one workspace for school administrators.'
            : 'A shared space for students, families, and educators to stay connected.')}
        </p>}
      </div>
      {!home && !hideCampusStoryDetails && <p className="story-footer-note">A more connected school community.</p>}
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
    <main className={`entry-page${portal === null ? ' entry-page-home' : ''}${portal === 'campus' && !selectedRole ? ' entry-page-school-roles' : ''}${portal === 'campus' && selectedRole ? ' entry-page-campus-login' : ''}`}>
      <header className="entry-header">
        <Brand />
        <div className="entry-header-actions">
          {portal && !(portal === 'campus' && (!selectedRole || selectedRole === 'PARENT' || selectedRole === 'STUDENT' || selectedRole === 'TEACHER')) && <button className="entry-back-link" type="button" onClick={onBack}>← <span>Geri</span></button>}
          <ThemeButton theme={theme} onClick={onToggleTheme} />
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
                const roleImage = campusRole === 'PARENT' ? 'role-parent.png' : campusRole === 'STUDENT' ? 'role-student.png' : 'role-teacher.png'
                return (
                  <button className={`role-option role-option-${item.color}`} key={campusRole} type="button" onClick={() => onChooseRole(campusRole)}>
                    <span className="role-option-index">0{index + 1}</span>
                    <span className="role-option-icon"><img src={`/images/${roleImage}`} alt="" /></span>
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
              {(role === 'PARENT' || role === 'STUDENT' || role === 'TEACHER') && <button className="entry-return-link entry-login-return" type="button" onClick={onBack}>← Back to school portal</button>}
          </div>
        </section>
      )}

      <footer className="entry-page-footer"><span>ClassBridge</span><i aria-hidden="true" /> A more connected school community.</footer>
    </main>
  )
}
