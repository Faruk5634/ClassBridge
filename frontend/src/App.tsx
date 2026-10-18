import { useEffect, useState } from 'react'
import LoginExperience, { type CampusRole, type EntryPortal, type ThemeMode } from './LoginExperience'

type LoginResponse = {
  accessToken: string
}

type AccountProfile = {
  role: 'SUPERADMIN' | 'SCHOOL_ADMIN' | 'SCHOOL_VICE_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT'
}

const TOKEN_KEY = 'classbridge.accessToken'
const THEME_KEY = 'classbridge.theme'

export default function App() {
  const [portal, setPortal] = useState<EntryPortal | null>(null)
  const [selectedRole, setSelectedRole] = useState<CampusRole | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(() => localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [sessionMessage, setSessionMessage] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  async function handleSignIn(username: string, password: string) {
    setLoginError('')
    setSessionMessage('')
    setIsSigningIn(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        setLoginError('Incorrect username or password. Check your details and try again.')
        return
      }

      const login = await response.json() as LoginResponse
      if (!login.accessToken) {
        setLoginError('ClassBridge could not start your session. Please try again.')
        return
      }

      const profileResponse = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${login.accessToken}` },
      })
      if (!profileResponse.ok) {
        setLoginError('ClassBridge could not verify this account. Please sign in again.')
        return
      }

      const profile = await profileResponse.json() as AccountProfile
      const isManagementRole = ['SUPERADMIN', 'SCHOOL_ADMIN', 'SCHOOL_VICE_ADMIN'].includes(profile.role)
      const matchesPortal = portal === 'management'
        ? isManagementRole
        : profile.role === selectedRole

      if (!matchesPortal) {
        setLoginError('This account does not belong to the selected portal. Choose the correct portal and try again.')
        return
      }

      sessionStorage.setItem(TOKEN_KEY, login.accessToken)
      setSessionMessage('Sign-in successful. Your ClassBridge workspace is the next step.')
    } catch {
      setLoginError('Could not connect to ClassBridge. Check that the server is running and try again.')
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <LoginExperience
      portal={portal}
      selectedRole={selectedRole}
      theme={theme}
      isSigningIn={isSigningIn}
      loginError={loginError}
      sessionMessage={sessionMessage}
      onChoosePortal={(nextPortal) => { setPortal(nextPortal); setSelectedRole(null); setLoginError(''); setSessionMessage('') }}
      onChooseRole={(role) => { setSelectedRole(role); setLoginError(''); setSessionMessage('') }}
      onBack={() => {
        setLoginError('')
        setSessionMessage('')
        if (portal === 'campus' && selectedRole) setSelectedRole(null)
        else { setPortal(null); setSelectedRole(null) }
      }}
      onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      onSignIn={handleSignIn}
    />
  )
}
