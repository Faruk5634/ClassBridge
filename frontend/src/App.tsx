import { useEffect, useState } from 'react'
import LoginExperience, { type CampusRole, type EntryPortal, type ThemeMode } from './LoginExperience'

type LoginResponse = {
  accessToken: string
}

type AccountProfile = {
  role: 'SUPERADMIN' | 'SCHOOL_ADMIN' | 'SCHOOL_VICE_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT'
}

type EntryRoute = {
  portal: EntryPortal | null
  role: CampusRole | null
}

type EntryHistoryState = {
  classBridgeEntryDepth?: number
}

const TOKEN_KEY = 'classbridge.accessToken'
const THEME_KEY = 'classbridge.theme'

function readEntryRoute(): EntryRoute {
  const route = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (route === 'management') return { portal: 'management', role: null }
  if (route === 'campus') return { portal: 'campus', role: null }

  const campusRole = route.match(/^campus\/(parent|student|teacher)$/)?.[1]
  if (campusRole) return { portal: 'campus', role: campusRole.toUpperCase() as CampusRole }

  return { portal: null, role: null }
}

function entryHash(route: EntryRoute) {
  if (!route.portal) return '#home'
  if (route.portal === 'management') return '#management'
  return route.role ? `#campus/${route.role.toLowerCase()}` : '#campus'
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light')
  const [entryRoute, setEntryRoute] = useState<EntryRoute>(readEntryRoute)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [sessionMessage, setSessionMessage] = useState('')
  const { portal, role: selectedRole } = entryRoute

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const currentState = window.history.state as EntryHistoryState | null
    if (!Number.isInteger(currentState?.classBridgeEntryDepth)) {
      window.history.replaceState({ classBridgeEntryDepth: 0 }, '', window.location.href)
    }

    const syncRoute = () => {
      setEntryRoute(readEntryRoute())
      setLoginError('')
      setSessionMessage('')
    }
    window.addEventListener('popstate', syncRoute)
    window.addEventListener('hashchange', syncRoute)
    return () => {
      window.removeEventListener('popstate', syncRoute)
      window.removeEventListener('hashchange', syncRoute)
    }
  }, [])

  function navigateEntry(nextRoute: EntryRoute) {
    if (window.location.hash === entryHash(nextRoute)) return

    const currentState = window.history.state as EntryHistoryState | null
    const depth = typeof currentState?.classBridgeEntryDepth === 'number' && Number.isInteger(currentState.classBridgeEntryDepth)
      ? currentState.classBridgeEntryDepth
      : 0
    window.history.pushState({ classBridgeEntryDepth: depth + 1 }, '', entryHash(nextRoute))
    setEntryRoute(nextRoute)
    setLoginError('')
    setSessionMessage('')
  }

  function goBackEntry() {
    const currentState = window.history.state as EntryHistoryState | null
    if (Number.isInteger(currentState?.classBridgeEntryDepth) && currentState!.classBridgeEntryDepth! > 0) {
      window.history.back()
      return
    }

    const fallbackRoute: EntryRoute = selectedRole
      ? { portal: 'campus', role: null }
      : { portal: null, role: null }
    window.history.replaceState({ classBridgeEntryDepth: 0 }, '', entryHash(fallbackRoute))
    setEntryRoute(fallbackRoute)
    setLoginError('')
    setSessionMessage('')
  }

  async function handleSignIn(username: string, password: string) {
    setLoginError('')
    setSessionMessage('')
    setIsSigningIn(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
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
      onChoosePortal={(nextPortal) => navigateEntry({ portal: nextPortal, role: null })}
      onChooseRole={(nextRole) => navigateEntry({ portal: 'campus', role: nextRole })}
      onBack={goBackEntry}
      onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      onSignIn={handleSignIn}
    />
  )
}
