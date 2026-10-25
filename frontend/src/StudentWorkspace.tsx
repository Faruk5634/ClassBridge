import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ThemeMode } from './LoginExperience'
import { fetchCached, invalidateCachedGetRequests } from './apiClient'
import CampusMemberWorkspace from './CampusMemberWorkspace'
import SchoolSuppliesPattern from './SchoolSuppliesPattern'
import WorkspaceTransition from './WorkspaceTransition'
import './StudentWorkspace.css'

type Profile = { userAccountId: number; username: string; role: 'PARENT' | 'STUDENT'; firstName: string | null; lastName: string | null; email?: string | null; emailVerified?: boolean; phoneNumber?: string | null }
export type ParentChild = { studentProfileId: number; firstName: string; lastName: string; schoolName: string; educationLevel: string; classroomId: number; gradeLevel: number; sectionName: string }
type StudentClass = { studentProfileId: number; schoolId?: number; schoolName: string; classroomId: number; gradeLevel: number; sectionName: string; homeroomTeacherName?: string }
type AnnouncementType = 'GENERAL' | 'HOMEWORK' | 'EXAM' | 'EXAM_RESULTS' | 'EVENT'
type Attachment = { id: number; displayFilename: string; contentType: string; size: number; createdAt?: string }
type TargetClassroom = { id?: number; classroomId?: number; gradeLevel: number; sectionName: string }
type Announcement = { id: number; schoolId: number; title: string; body: string; type: AnnouncementType; authorDisplayName: string; targetClassrooms: TargetClassroom[]; attachments: Attachment[]; createdAt: string }
type Conversation = { id: number; schoolId: number; studentProfileId: number | null; studentDisplayName: string | null; otherParticipantAccountId: number; otherParticipantDisplayName: string; otherParticipantAppearance?: Appearance; otherParticipantRole: string; readOnly: boolean; unreadCount: number; latestMessage: string | null; createdAt: string; lastMessageAt: string }
type DirectMessage = { id: number; senderAccountId: number; senderDisplayName: string; senderRole: string; parentAuthored: boolean; message: string; createdAt: string; readAt: string | null; attachments: Attachment[] }
type ConversationDetail = { conversation: Conversation; messages: DirectMessage[] }
type Recipient = { accountId: number; role: string; displayName: string; studentProfileId?: number | null; schoolNumber?: string | null; schoolId: number }
type Appearance = { avatarType: 'INITIALS' | 'ANIMAL' | 'PHOTO'; animal: string | null; imageDataUrl: string | null }
type Route = { view: 'today' | 'announcements' | 'messages' | 'profile'; announcementId?: number; conversationId?: number; newMessage?: boolean }
type Props = { theme: ThemeMode; token: string; profile: Profile; onToggleTheme: () => void; onSignOut: () => void; onSessionExpired: () => void; parentView?: { child: ParentChild; onReturnToParent: () => void; confirmReturn?: boolean; onCancelReturn?: () => void } }

const WORKSPACE_CACHE_MS = 30_000

const announcementKinds: { value: 'ALL' | AnnouncementType; label: string }[] = [
  { value: 'ALL', label: 'All notices' }, { value: 'GENERAL', label: 'General' },
  { value: 'HOMEWORK', label: 'Homework' }, { value: 'EXAM', label: 'Exam' },
  { value: 'EXAM_RESULTS', label: 'Exam results' }, { value: 'EVENT', label: 'Events' },
]
const categoryLabels: Record<AnnouncementType, string> = {
  GENERAL: 'General notice', HOMEWORK: 'Homework notice', EXAM: 'Exam announcement',
  EXAM_RESULTS: 'Exam results', EVENT: 'School event',
}

class ApiError extends Error { readonly status: number; constructor(message: string, status: number) { super(message); this.status = status } }
async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', 'Bearer ' + token)
  headers.set('Accept', 'application/json')
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json')
  const response = await fetchCached(path, { ...init, headers })
  const text = await response.text()
  let payload: { message?: string } | null = null
  if (text) { try { payload = JSON.parse(text) as { message?: string } } catch { payload = null } }
  if (!response.ok) throw new ApiError(payload?.message || `The request could not be completed (${response.status}).`, response.status)
  return (text ? payload : null) as T
}
function readRoute(parentStudentProfileId?: number): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/')
  const parentRoute = parentStudentProfileId !== undefined
    && parts[0] === 'campus' && parts[1] === 'parent' && parts[2] === 'children'
    && Number(parts[3]) === parentStudentProfileId
  if (parentStudentProfileId !== undefined && !parentRoute) return { view: 'today' }
  if (parentStudentProfileId === undefined && (parts[0] !== 'campus' || parts[1] !== 'student')) return { view: 'today' }
  const routeStart = parentStudentProfileId === undefined ? 2 : 4
  if (parts[routeStart] === 'announcements' && Number(parts[routeStart + 1]) > 0) return { view: 'announcements', announcementId: Number(parts[routeStart + 1]) }
  if (parts[routeStart] === 'announcements') return { view: 'announcements' }
  if (parts[routeStart] === 'messages' && parts[routeStart + 1] === 'new') return { view: 'messages', newMessage: true }
  if (parts[routeStart] === 'messages' && Number(parts[routeStart + 1]) > 0) return { view: 'messages', conversationId: Number(parts[routeStart + 1]) }
  if (parts[routeStart] === 'messages') return { view: 'messages' }
  if (parts[routeStart] === 'profile' && parentStudentProfileId === undefined) return { view: 'profile' }
  return { view: 'today' }
}
function routeHash(route: Route, parentStudentProfileId?: number) {
  const base = parentStudentProfileId === undefined ? '#campus/student' : `#campus/parent/children/${parentStudentProfileId}`
  if (route.announcementId) return base + '/announcements/' + route.announcementId
  if (route.view === 'announcements') return base + '/announcements'
  if (route.newMessage) return base + '/messages/new'
  if (route.conversationId) return base + '/messages/' + route.conversationId
  if (route.view === 'messages') return base + '/messages'
  if (route.view === 'profile' && parentStudentProfileId === undefined) return base + '/profile'
  return base
}
function fullName(profile: Profile) { return [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username }
function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CB' }
function stamp(value?: string | null) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toDateString() === new Date().toDateString()
    ? 'Today · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function summary(value: string) { const normalized = value.replace(/\s+/g, ' ').trim(); return normalized.length > 170 ? normalized.slice(0, 167).trimEnd() + '…' : normalized }
function relativeRole(value: string) { return value.replaceAll('_', ' ').toLocaleLowerCase('en-US').replace(/^\w/, (letter) => letter.toUpperCase()) }
function animalSprite(animal: string | null) {
  if (!animal) return null
  const [species = '', group = 'STUDENT'] = animal.split('_')
  const names = ['LION', 'BEAR', 'KOALA', 'TURTLE', 'OWL', 'HIPPO', 'SNAKE', 'FOX', 'RABBIT', 'OTTER', 'CHEETAH']
  const index = names.indexOf(species)
  if (index < 0) return null
  const row = Math.floor(index / 4)
  const column = index % 4
  return {
    backgroundImage: `url('/images/profile-animals-${group === 'ADULT' ? 'adults' : 'students'}.jpg')`,
    backgroundSize: '400% 400%',
    backgroundPosition: `${(column / 3) * 100}% ${['0%', '44.44%', '88.89%'][row] ?? '0%'}`,
  }
}

function StudentAvatar({ appearance, profile, compact = false }: { appearance: Appearance; profile: Profile; compact?: boolean }) {
  const animalStyle = animalSprite(appearance.animal)
  return <span className={'student-preview-avatar' + (compact ? ' is-compact' : '')} role="img" aria-label={`${fullName(profile)}’s account portrait`}>
    {appearance.avatarType === 'PHOTO' && appearance.imageDataUrl
      ? <img src={appearance.imageDataUrl} alt="" />
      : appearance.avatarType === 'ANIMAL' && animalStyle
        ? <span className="student-workspace-avatar-art" style={animalStyle} />
        : initials(fullName(profile))}
  </span>
}

function ConversationAvatar({ appearance, name, className = '' }: { appearance?: Appearance; name: string; className?: string }) {
  const saved = appearance ?? { avatarType: 'INITIALS' as const, animal: null, imageDataUrl: null }
  const art = animalSprite(saved.animal)
  return <span className={'student-preview-staff-avatar student-conversation-avatar ' + className} aria-hidden="true">{saved.avatarType === 'PHOTO' && saved.imageDataUrl ? <img src={saved.imageDataUrl} alt="" /> : saved.avatarType === 'ANIMAL' && art ? <span className="student-workspace-avatar-art" style={art} /> : initials(name)}</span>
}

function BeaverMascot({ pose, hint }: { pose: 'wave' | 'announcement' | 'message'; hint: string }) {
  const images = pose === 'announcement'
    ? ['/images/beaver-announcement-rest.png', '/images/beaver-announcement-cutout.png']
    : pose === 'message'
      ? ['/images/beaver-message-rest.png', '/images/beaver-message-raised.png']
      : ['/images/beaver-guide-cutout.png', '/images/beaver-guide-wave.png']
  return <div className="student-preview-mascot" tabIndex={0} aria-label="ClassBridge beaver mascot">
    <img className="student-preview-pose-rest" src={images[0]} alt="ClassBridge beaver mascot" />
    <img className="student-preview-pose-hover" src={images[1]} alt="" aria-hidden="true" />
    <span>{hint}</span>
  </div>
}

function NoticeIcon({ kind }: { kind: AnnouncementType }) {
  const drawings: Record<AnnouncementType, ReactNode> = {
    GENERAL: <><path d="M12 20s-7.5-4.3-7.5-9.3a4.1 4.1 0 0 1 7.5-2.3 4.1 4.1 0 0 1 7.5 2.3C19.5 15.7 12 20 12 20Z" /><path d="M7 12h3l1.3-2.5 2.1 5 1.3-2.5H18" /></>,
    HOMEWORK: <><path d="M5 4.5h14v15H5z" /><path d="M8 8h8M8 11h8M8 14h5" /><path d="M8 4.5v2" /></>,
    EXAM: <><path d="m5 17 10.8-10.8 3 3L8 20H5v-3Z" /><path d="m14.5 7.5 3 3M5 22h14" /></>,
    EVENT: <><path d="M6 9h12l-1.2 10H7.2L6 9Z" /><path d="M9 9a3 3 0 0 1 6 0M12 4V2M8 21h8" /></>,
    EXAM_RESULTS: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{drawings[kind]}</svg>
}

function NoticeType({ kind }: { kind: AnnouncementType }) { return <span className={'student-preview-type type-' + kind.toLowerCase()}><NoticeIcon kind={kind} /><span>{categoryLabels[kind]}</span></span> }

function PushpinIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 3.5h7l-.8 4.2 3.1 3.1v1.4H6.2v-1.4l3.1-3.1-.8-4.2Z" /><path d="M12 12.2v8.3" /></svg>
}

function AnnouncementCard({ item, pinned, onTogglePin, onOpen, featured = false, listIndex }: {
  item: Announcement; pinned: boolean; onTogglePin: (id: number) => void; onOpen: (item: Announcement) => void; featured?: boolean; listIndex?: number
}) {
  const listLayout = listIndex !== undefined
  const pinButton = <button className={'student-preview-star' + (pinned ? ' is-pinned' : '')} onClick={() => onTogglePin(item.id)} type="button" aria-label={pinned ? 'Remove from important announcements' : 'Pin to important announcements'} title={pinned ? 'Remove from important announcements' : 'Pin to important announcements'}><PushpinIcon /></button>
  return <article className={'student-preview-notice' + (featured ? ' is-featured' : '') + (listLayout ? ' is-list-row' : '')}>
    {featured && <div className="student-preview-note-index"><span>01</span><i /></div>}
    {listLayout && <span className="student-preview-row-index">{String(listIndex).padStart(2, '0')}</span>}
    {listLayout && <time className="student-preview-row-time">{stamp(item.createdAt)}</time>}
    <div className="student-preview-notice-copy">
      {listLayout ? <div className="student-preview-row-audience"><NoticeType kind={item.type} /></div> : <div className="student-preview-notice-meta"><NoticeType kind={item.type} /><time>{stamp(item.createdAt)}</time></div>}
      <h3><button type="button" onClick={() => onOpen(item)}>{item.title}</button></h3>
      <p>{summary(item.body)}</p>
      {listLayout ? <div className="student-preview-row-byline">Shared by <strong>{item.authorDisplayName || 'your school'}</strong></div> : <div className="student-preview-notice-byline"><span className="student-preview-staff-avatar">{initials(item.authorDisplayName || 'School')}</span><span>Shared by <strong>{item.authorDisplayName || 'your school'}</strong></span></div>}
      {item.attachments?.map((attachment) => <span className="student-preview-attachment" key={attachment.id}><span aria-hidden="true">↳</span>{attachment.displayFilename}<small>{Math.round(attachment.size / 1024)} KB</small></span>)}
    </div>
    {listLayout ? <div className="student-preview-row-actions">{pinButton}<button className="student-preview-row-open" onClick={() => onOpen(item)} type="button" aria-label={'Open announcement: ' + item.title}>↗</button></div> : pinButton}
  </article>
}

export default function StudentWorkspace({ theme, token, profile, onToggleTheme, onSignOut, onSessionExpired, parentView }: Props) {
  const parentChild = parentView?.child
  const parentStudentProfileId = parentChild?.studentProfileId
  const [today] = useState(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()))
  const [route, setRoute] = useState<Route>(() => readRoute(parentStudentProfileId))
  const [studentClass, setStudentClass] = useState<StudentClass | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const readConversationIds = useRef(new Map<number, number>())
  const conversationDetailCache = useRef(new Map<string, { detail: ConversationDetail; fetchedAt: number }>())
  const dataFetchedAt = useRef({ studentClass: 0, announcements: 0, conversations: 0 })
  const loadedData = useRef({ studentClass: false, announcements: false })
  const [appearance, setAppearance] = useState<Appearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => {
    try { return (JSON.parse(localStorage.getItem('classbridge.student.pinned.' + (parentStudentProfileId ?? profile.userAccountId)) || '[]') as number[]).slice(0, 10) } catch { return [] }
  })
  const [category, setCategory] = useState<'ALL' | AnnouncementType>('ALL')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [classError, setClassError] = useState('')
  const [announcementError, setAnnouncementError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [toast, setToast] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [confirmParentReturn, setConfirmParentReturn] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [transitionLabel, setTransitionLabel] = useState('')
  const navigationTimer = useRef<number | null>(null)
  const errorToastTimer = useRef<number | null>(null)
  const [thread, setThread] = useState<ConversationDetail | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState('')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null)
  const [recipientLoading, setRecipientLoading] = useState(false)
  const [firstMessage, setFirstMessage] = useState('')
  const conversationsLoaded = useRef(false)
  const previousView = useRef(route.view)

  const notifyError = useCallback((message: string) => {
    setToast(message)
    if (errorToastTimer.current !== null) window.clearTimeout(errorToastTimer.current)
    errorToastTimer.current = window.setTimeout(() => { setToast(''); errorToastTimer.current = null }, 7000)
  }, [])
  const dismissErrorToast = useCallback(() => {
    if (errorToastTimer.current !== null) window.clearTimeout(errorToastTimer.current)
    errorToastTimer.current = null
    setToast('')
  }, [])
  const handleSessionExpired = useCallback(() => setSessionExpired(true), [])
  const handleApiError = useCallback((error: unknown, setter?: (message: string) => void) => {
    if (error instanceof ApiError && error.status === 401) { handleSessionExpired(); return }
    const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
    if (setter) setter(message)
    else notifyError(message)
  }, [notifyError, handleSessionExpired])

  useEffect(() => {
    const sync = () => {
      if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
      const next = readRoute(parentStudentProfileId)
      setTransitionLabel('Loading…'); setProfileMenuOpen(false); dismissErrorToast()
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      navigationTimer.current = window.setTimeout(() => { setRoute(next); setTransitionLabel(''); navigationTimer.current = null; window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }) }, reducedMotion ? 0 : 700)
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [dismissErrorToast, parentStudentProfileId])
  useEffect(() => () => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
    if (errorToastTimer.current !== null) window.clearTimeout(errorToastTimer.current)
  }, [])
  useEffect(() => {
    const closeMenu = (event: PointerEvent) => { if (!(event.target as Element).closest('.student-preview-profile-menu')) setProfileMenuOpen(false) }
    const closeDialog = (event: KeyboardEvent) => { if (event.key === 'Escape') { setConfirmSignOut(false); setConfirmParentReturn(false); parentView?.onCancelReturn?.() } }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeDialog)
    return () => { document.removeEventListener('pointerdown', closeMenu); document.removeEventListener('keydown', closeDialog) }
  }, [parentView])

  useEffect(() => {
    let active = true
    const now = Date.now()
    const childContext = parentStudentProfileId === undefined ? '' : '?studentProfileId=' + parentStudentProfileId
    const enteringMessages = route.view === 'messages' && previousView.current !== 'messages'
    previousView.current = route.view
    const needsClass = route.view === 'today' || (route.view === 'messages' && route.newMessage)
    const needsAnnouncements = route.view === 'today' || route.view === 'announcements'
    const shouldLoadClass = needsClass && (!loadedData.current.studentClass || now - dataFetchedAt.current.studentClass >= WORKSPACE_CACHE_MS)
    const shouldLoadAnnouncements = needsAnnouncements && (!loadedData.current.announcements || now - dataFetchedAt.current.announcements >= WORKSPACE_CACHE_MS)
    const shouldLoadConversations = !conversationsLoaded.current
      || (enteringMessages && now - dataFetchedAt.current.conversations >= WORKSPACE_CACHE_MS)
    const classRequest = !shouldLoadClass
      ? Promise.resolve(null)
      : parentChild
        ? Promise.resolve({
          studentProfileId: parentChild.studentProfileId,
          schoolName: parentChild.schoolName,
          classroomId: parentChild.classroomId,
          gradeLevel: parentChild.gradeLevel,
          sectionName: parentChild.sectionName,
          homeroomTeacherName: '',
        } satisfies StudentClass)
        : api<StudentClass>('/api/student/profile', token)
    const requests = Promise.allSettled([
      classRequest,
      shouldLoadAnnouncements
        ? api<Announcement[]>(parentStudentProfileId !== undefined ? `/api/parent/children/${parentStudentProfileId}/announcements` : '/api/student/announcements', token)
        : Promise.resolve(null),
      shouldLoadConversations ? api<Conversation[]>('/api/messages/conversations' + childContext, token) : Promise.resolve(null),
    ])
    requests.then((results) => {
      if (!active) return
      const unauthenticated = results.find((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401)
      if (unauthenticated?.status === 'rejected') { handleSessionExpired(); return }
      const [classResult, announcementResult, messageResult] = results
      if (classResult.status === 'fulfilled' && classResult.value) {
        loadedData.current.studentClass = true
        dataFetchedAt.current.studentClass = Date.now()
        setStudentClass(classResult.value)
      }
      else if (classResult.status === 'rejected') handleApiError(classResult.reason, setClassError)
      if (announcementResult.status === 'fulfilled' && announcementResult.value) {
        loadedData.current.announcements = true
        dataFetchedAt.current.announcements = Date.now()
        setAnnouncements(announcementResult.value.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
      }
      else if (announcementResult.status === 'rejected') handleApiError(announcementResult.reason, setAnnouncementError)
      if (messageResult.status === 'fulfilled' && messageResult.value) {
        conversationsLoaded.current = true
        dataFetchedAt.current.conversations = Date.now()
        setConversations(messageResult.value.map((item) => { const readAt = readConversationIds.current.get(item.id); return readAt !== undefined && Date.parse(item.lastMessageAt) <= readAt ? { ...item, unreadCount: 0 } : item }).slice().sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)))
      } else if (messageResult.status === 'rejected') handleApiError(messageResult.reason, setMessageError)
    }).finally(() => { if (active) setLoading(false) })
    const hasRequests = shouldLoadClass || shouldLoadAnnouncements || shouldLoadConversations
    setLoading(hasRequests && (
      (shouldLoadClass && !loadedData.current.studentClass)
      || (shouldLoadAnnouncements && !loadedData.current.announcements)
      || (shouldLoadConversations && !conversationsLoaded.current)
    ))
    if (!hasRequests) setLoading(false)
    return () => { active = false }
  }, [route.view, route.newMessage, token, parentStudentProfileId, parentChild, handleApiError, handleSessionExpired])

  useEffect(() => {
    let active = true
    api<Appearance>('/api/auth/appearance', token)
      .then((value) => { if (active && value) setAppearance(value) })
      .catch((error) => { if (active) handleApiError(error) })
    return () => { active = false }
  }, [token, handleApiError])

  useEffect(() => {
    try { localStorage.setItem('classbridge.student.pinned.' + (parentStudentProfileId ?? profile.userAccountId), JSON.stringify(pinnedIds)) } catch { notifyError('Your saved announcements could not be stored in this browser.') }
  }, [pinnedIds, profile.userAccountId, parentStudentProfileId, notifyError])

  useEffect(() => {
    if (!route.conversationId) { setThread(null); setThreadError(''); return }
    const conversationId = route.conversationId
    const cacheKey = `${parentStudentProfileId ?? 'student'}:${conversationId}`
    const cached = conversationDetailCache.current.get(cacheKey)
    const listedConversation = conversations.find((item) => item.id === conversationId)
    const cacheMatchesList = !listedConversation || listedConversation.lastMessageAt === cached?.detail.conversation.lastMessageAt
    if (cached && Date.now() - cached.fetchedAt < WORKSPACE_CACHE_MS && cacheMatchesList) {
      const readAt = cached.detail.messages.reduce((latest, message) => Math.max(latest, Date.parse(message.createdAt) || 0), 0)
      readConversationIds.current.set(conversationId, readAt)
      setThread(cached.detail)
      setThreadError('')
      setThreadLoading(false)
      setConversations((items) => {
        let changed = false
        const next = items.map((item) => {
          if (item.id !== conversationId) return item
          const updated = { ...item, latestMessage: cached.detail.conversation.latestMessage, lastMessageAt: cached.detail.conversation.lastMessageAt, unreadCount: 0 }
          if (item.latestMessage === updated.latestMessage && item.lastMessageAt === updated.lastMessageAt && item.unreadCount === 0) return item
          changed = true
          return updated
        })
        return changed ? next : items
      })
      return
    }
    let active = true
    setThreadLoading(true)
    setThreadError('')
    api<ConversationDetail>('/api/messages/conversations/' + conversationId + (parentStudentProfileId === undefined ? '' : '?studentProfileId=' + parentStudentProfileId), token)
      .then((value) => { if (active) { const readAt = value.messages.reduce((latest, message) => Math.max(latest, Date.parse(message.createdAt) || 0), 0); readConversationIds.current.set(conversationId, readAt); invalidateCachedGetRequests('Bearer ' + token, (url) => url === '/api/messages/conversations' + (parentStudentProfileId === undefined ? '' : '?studentProfileId=' + parentStudentProfileId)); conversationDetailCache.current.set(cacheKey, { detail: value, fetchedAt: Date.now() }); setThread(value); setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, latestMessage: value.conversation.latestMessage, lastMessageAt: value.conversation.lastMessageAt, unreadCount: 0 } : item)) } })
      .catch((error) => { if (active) handleApiError(error, setThreadError) })
      .finally(() => { if (active) setThreadLoading(false) })
    return () => { active = false }
  }, [route.conversationId, token, parentStudentProfileId, handleApiError, conversations])

  useEffect(() => {
    const search = recipientQuery.trim()
    if (!route.newMessage || selectedRecipient || search.length < 2) { setRecipients([]); return }
    let active = true
    const timer = window.setTimeout(() => {
      setRecipientLoading(true)
      api<Recipient[]>('/api/messages/recipients?query=' + encodeURIComponent(search) + (parentStudentProfileId === undefined ? '' : '&studentProfileId=' + parentStudentProfileId), token)
        .then((values) => { if (active) setRecipients(values ?? []) })
        .catch((error) => { if (active) handleApiError(error, setMessageError) })
        .finally(() => { if (active) setRecipientLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [route.newMessage, recipientQuery, selectedRecipient, token, parentStudentProfileId, handleApiError])

  function navigate(next: Route, replace = false) {
    if (parentStudentProfileId !== undefined && next.view === 'profile') return
    const hash = routeHash(next, parentStudentProfileId)
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
    setProfileMenuOpen(false)
    dismissErrorToast()
    setThreadError('')
    if (next.newMessage) { setSelectedRecipient(null); setRecipientQuery(''); setRecipients([]); setFirstMessage(''); setMessageError('') }
    if (!replace && window.location.hash === hash) { setRoute(next); return }
    setTransitionLabel('Loading…')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    navigationTimer.current = window.setTimeout(() => {
      if (replace) window.history.replaceState(window.history.state, '', hash)
      else window.history.pushState({}, '', hash)
      setRoute(next); setTransitionLabel(''); navigationTimer.current = null
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    }, reducedMotion ? 0 : 700)
  }

  function togglePinned(id: number) {
    if (pinnedIds.includes(id)) { setPinnedIds((current) => current.filter((value) => value !== id)); return }
    if (pinnedIds.length >= 10) { notifyError('Your important announcements board is full. Unpin one notice to add another.'); return }
    setPinnedIds((current) => [id, ...current])
  }

  async function downloadAttachment(path: string, attachment: Attachment) {
    try {
      const response = await fetch(path, { headers: { Authorization: 'Bearer ' + token } })
      if (response.status === 401) { handleSessionExpired(); return }
      if (!response.ok) throw new Error('This file could not be downloaded. Please try again.')
      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = objectUrl; link.download = attachment.displayFilename; document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (error) { notifyError(error instanceof Error ? error.message : 'This file could not be downloaded.') }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!route.conversationId || !reply.trim() || sending || thread?.conversation.readOnly) return
    setSending(true); setThreadError('')
    try {
      const sent = await api<DirectMessage>('/api/messages/conversations/' + route.conversationId + '/messages' + (parentStudentProfileId === undefined ? '' : '?studentProfileId=' + parentStudentProfileId), token, { method: 'POST', body: JSON.stringify({ message: reply.trim() }) })
      setThread((current) => {
        if (!current) return current
        const updated = { ...current, conversation: { ...current.conversation, latestMessage: sent.message, lastMessageAt: sent.createdAt, unreadCount: 0 }, messages: [...current.messages, sent] }
        conversationDetailCache.current.set(`${parentStudentProfileId ?? 'student'}:${route.conversationId}`, { detail: updated, fetchedAt: Date.now() })
        return updated
      })
      setConversations((items) => items.map((item) => item.id === route.conversationId ? { ...item, latestMessage: sent.message, lastMessageAt: sent.createdAt, unreadCount: 0 } : item))
      dataFetchedAt.current.conversations = Date.now()
      setReply('')
    } catch (error) { handleApiError(error) }
    finally { setSending(false) }
  }

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRecipient || !firstMessage.trim() || sending) return
    setSending(true); setMessageError('')
    try {
      const started = await api<Conversation>('/api/messages/conversations', token, {
        method: 'POST',
        body: JSON.stringify({ recipientAccountId: selectedRecipient.accountId, studentProfileId: parentStudentProfileId ?? studentClass?.studentProfileId, message: firstMessage.trim() }),
      })
      setConversations((current) => [started, ...current.filter((item) => item.id !== started.id)])
      conversationsLoaded.current = true
      dataFetchedAt.current.conversations = Date.now()
      navigate({ view: 'messages', conversationId: started.id })
    } catch (error) { handleApiError(error) }
    finally { setSending(false) }
  }

  const full = fullName(profile)
  const childName = parentView ? [parentView.child.firstName, parentView.child.lastName].filter(Boolean).join(' ') : ''
  const greeting = parentView ? (parentView.child.firstName || childName || 'Student') : (profile.firstName || profile.username)
  const selectedAnnouncement = announcements.find((item) => item.id === route.announcementId) ?? null
  const selectedConversation = thread?.conversation ?? conversations.find((item) => item.id === route.conversationId) ?? null
  const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0)
  const recentRecipients = useMemo<Recipient[]>(() => {
    const seen = new Set<number>()
    return conversations.flatMap((item) => {
      if (seen.has(item.otherParticipantAccountId)) return []
      seen.add(item.otherParticipantAccountId)
      return [{ accountId: item.otherParticipantAccountId, role: item.otherParticipantRole, displayName: item.otherParticipantDisplayName, studentProfileId: item.studentProfileId, schoolId: item.schoolId }]
    }).slice(0, 3)
  }, [conversations])
  const pinnedItems = pinnedIds.map((id) => announcements.find((item) => item.id === id)).filter((item): item is Announcement => Boolean(item))
  const visibleAnnouncements = useMemo(() => announcements.filter((item) => {
    const matchesCategory = category === 'ALL' || item.type === category
    const search = query.trim().toLocaleLowerCase('en-US')
    const matchesSearch = !search || [item.title, item.body, item.authorDisplayName].some((value) => value?.toLocaleLowerCase('en-US').includes(search))
    return matchesCategory && matchesSearch
  }), [announcements, category, query])

  return <main className={'student-preview' + (theme === 'dark' ? ' is-dark' : '') + (parentView ? ' is-parent-child-view' : '')}>
    <header className="student-preview-topbar">
      <button className="student-preview-brand" onClick={() => parentView ? setConfirmParentReturn(true) : navigate({ view: 'today' })} type="button" aria-label={parentView ? 'Return to parent home' : 'ClassBridge home'}><img src="/images/classbridge-bridge-logo.png" alt="ClassBridge" /></button>
      <nav className="student-preview-nav" aria-label="Student workspace">
        {([...([['today', 'Today'], ['announcements', 'Announcements'], ['messages', 'Messages']] as const), ...(!parentView ? [['profile', 'My profile'] as const] : [])] as const).map(([key, label]) => {
          const active = route.view === key
          return <button key={key} className={active ? 'is-active' : ''} onClick={() => navigate({ view: key })} type="button" aria-current={active ? 'page' : undefined}>{label}{key === 'messages' && unread > 0 && <i className="student-preview-nav-unread">{unread}</i>}</button>
        })}
      </nav>
      <div className="student-preview-actions">
        <button className="student-preview-theme" onClick={onToggleTheme} type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M2 12h2m16 0h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.2 8.2 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></svg>}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
        {parentView && <button className="student-preview-parent-return" onClick={() => setConfirmParentReturn(true)} type="button">← Parent home</button>}
        <div className="student-preview-profile-menu"><button className="student-preview-profile-button" onClick={() => setProfileMenuOpen((open) => !open)} type="button" aria-label="Open profile menu" aria-expanded={profileMenuOpen}><StudentAvatar appearance={appearance} profile={profile} compact />{unread > 0 && <b className="student-preview-profile-unread" aria-label={`${unread} unread messages`}>{unread}</b>}<span>{full}</span><i>⌄</i></button>
          {profileMenuOpen && <div className="student-preview-dropdown" role="menu"><div className="student-preview-dropdown-person"><StudentAvatar appearance={appearance} profile={profile} /><strong>{full}</strong><small>{profile.email || profile.username}</small><small>{parentView ? 'Parent account' : 'Student account'}</small></div>{parentView ? <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setConfirmParentReturn(true) }} type="button">Return to parent home <span>Switch workspace</span></button> : <><button role="menuitem" onClick={() => navigate({ view: 'profile' })} type="button">My profile <span>Account settings</span></button><button role="menuitem" onClick={() => navigate({ view: 'messages' })} type="button">Messages <span>{unread ? `${unread} unread` : 'Open inbox'}</span></button></>}<button className="student-preview-signout" role="menuitem" onClick={() => { setProfileMenuOpen(false); setConfirmSignOut(true) }} type="button">Sign out</button></div>}
        </div>
      </div>
    </header>

    <div className="student-preview-content">
      {route.view === 'today' && <>
        <section className="student-preview-welcome"><BeaverMascot pose="wave" hint="Here to help" /><div className="student-preview-welcome-copy"><p className="student-preview-date"><i />{today.toUpperCase()}<b /> YOUR SCHOOL DAY</p><h1>Good day, {greeting}.</h1><p>Here’s the latest from your school community.</p></div><div className="student-preview-welcome-action"><button onClick={() => navigate({ view: 'announcements' })} type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg> View announcements</button><small>See what’s new at school</small></div><SchoolSuppliesPattern className="student-preview-supplies" /></section>

        <div className="student-preview-dashboard-grid">
          <section className="student-preview-latest"><div className="student-preview-section-heading"><div><p className="student-preview-overline">THE SCHOOL NOTICEBOARD</p><h2>Latest announcements</h2></div><button className="student-preview-text-action" onClick={() => navigate({ view: 'announcements' })} type="button">All announcements <span>→</span></button></div>
            {announcementError && <div className="student-preview-load-error" role="alert">Announcements could not be loaded: {announcementError}</div>}
            {loading ? <div className="student-preview-empty-card">Checking the school noticeboard…</div> : announcements.length === 0 ? <div className="student-preview-empty-card">{announcementError ? 'Try again after checking your connection.' : 'There are no announcements for your class yet.'}</div> : <>
              <AnnouncementCard item={announcements[0]} pinned={pinnedIds.includes(announcements[0].id)} onTogglePin={togglePinned} onOpen={(item) => navigate({ view: 'announcements', announcementId: item.id })} featured />
              {announcements.length > 1 && <><div className="student-preview-list-heading"><h3>More from your school</h3><span>{announcements.length - 1} {announcements.length === 2 ? 'notice' : 'notices'}</span></div><div className="student-preview-compact-list">{announcements.slice(1, 4).map((item) => <AnnouncementCard key={item.id} item={item} pinned={pinnedIds.includes(item.id)} onTogglePin={togglePinned} onOpen={(notice) => navigate({ view: 'announcements', announcementId: notice.id })} />)}</div></>}
            </>}
          </section>

          <aside className="student-preview-side-column">
            <section className="student-preview-side-panel student-preview-pinned-panel"><div className="student-preview-section-heading student-preview-small-heading"><div><p className="student-preview-overline">SAVED FOR LATER</p><h2>Important announcements</h2></div><span className="student-preview-count">{pinnedIds.length}/10</span></div>
              {pinnedItems.length === 0 ? <p className="student-preview-empty-copy">Pin an announcement to keep it here.</p> : <div className="student-preview-pinned-list">{pinnedItems.slice(0, 3).map((item) => <button key={item.id} className="student-preview-pinned-row" onClick={() => navigate({ view: 'announcements', announcementId: item.id })} type="button"><span className="student-preview-pin-mark"><PushpinIcon /></span><span><NoticeType kind={item.type} /><strong>{item.title}</strong><small>{stamp(item.createdAt)}</small></span><i>→</i></button>)}</div>}
              <button className="student-preview-panel-link" onClick={() => navigate({ view: 'announcements' })} type="button">Manage saved announcements <span>→</span></button>
            </section>

            <section className="student-preview-side-panel student-preview-class-panel"><div className="student-preview-section-heading student-preview-small-heading"><div><p className="student-preview-overline">{parentView ? 'CHILD’S CLASS' : 'YOUR CLASS'}</p><h2>{studentClass ? `${studentClass.gradeLevel}/${studentClass.sectionName}` : 'Class details'}</h2></div><span className="student-preview-class-mark">{studentClass ? String(studentClass.gradeLevel).padStart(2, '0') : '—'}</span></div>
              {classError ? <p className="student-preview-empty-copy student-preview-class-error" role="alert">Class information is temporarily unavailable.</p> : studentClass ? <>{studentClass.homeroomTeacherName ? <div className="student-preview-teacher"><span className="student-preview-staff-avatar">{initials(studentClass.homeroomTeacherName)}</span><span><small>Homeroom teacher</small><strong>{studentClass.homeroomTeacherName}</strong></span><span className="student-preview-teacher-status">●</span></div> : <div className="student-preview-parent-school"><small>School</small><strong>{studentClass.schoolName}</strong></div>}<p className="student-preview-class-footnote">{parentView ? 'You are viewing school updates for your child.' : 'Your class updates appear on the school noticeboard.'}</p></> : <p className="student-preview-empty-copy">Loading your class information…</p>}
            </section>

            <section className="student-preview-side-panel student-preview-messages-panel"><div className="student-preview-section-heading student-preview-small-heading"><div><p className="student-preview-overline">SCHOOL CONVERSATIONS</p><h2>Recent messages</h2></div><button className="student-preview-text-action" onClick={() => navigate({ view: 'messages' })} type="button">Inbox <span>→</span></button></div>
              {messageError ? <p className="student-preview-empty-copy student-preview-class-error" role="alert">Messages could not be loaded.</p> : conversations.length === 0 ? <p className="student-preview-empty-copy">No conversations yet.</p> : <div className="student-preview-message-list">{conversations.slice(0, 3).map((message) => <button key={message.id} className="student-preview-message-row" onClick={() => navigate({ view: 'messages', conversationId: message.id })} type="button"><ConversationAvatar appearance={message.otherParticipantAppearance} name={message.otherParticipantDisplayName || 'School'} /><span><strong>{message.otherParticipantDisplayName}</strong><small>{message.latestMessage || 'Open conversation'}</small></span>{message.unreadCount > 0 && <i>{message.unreadCount}</i>}</button>)}</div>}
            </section>
          </aside>
        </div>
      </>}

      {route.view === 'announcements' && !route.announcementId && <section className="student-preview-page">
        <div className="student-preview-page-heading"><div><p className="student-preview-overline">THE SCHOOL NOTICEBOARD</p><h1>Announcements</h1><p>School updates, shared with your class.</p></div><BeaverMascot pose="announcement" hint="Fresh from the noticeboard" /></div>
        <div className="student-preview-announcement-tools"><label className="student-preview-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search announcements" aria-label="Search announcements" /></label><div className="student-preview-category-filter" aria-label="Filter by announcement category">{announcementKinds.map((item) => <button key={item.value} className={category === item.value ? 'is-active' : ''} onClick={() => setCategory(item.value)} type="button">{item.label}</button>)}</div></div>
        {announcementError && <div className="student-preview-load-error" role="alert">Announcements could not be loaded: {announcementError}</div>}
        <div className="student-preview-announcement-columns">
          <section className="student-preview-announcement-section student-preview-all-announcements"><div className="student-preview-section-heading"><div><p className="student-preview-overline">LATEST FIRST</p><h2>All announcements</h2></div><span className="student-preview-count">{visibleAnnouncements.length} {visibleAnnouncements.length === 1 ? 'notice' : 'notices'}</span></div>{loading ? <p className="student-preview-empty-card">Loading announcements…</p> : visibleAnnouncements.length ? <div className="student-preview-announcement-grid student-preview-announcement-list">{visibleAnnouncements.map((item, index) => <AnnouncementCard key={item.id} item={item} listIndex={index + 1} pinned={pinnedIds.includes(item.id)} onTogglePin={togglePinned} onOpen={(notice) => navigate({ view: 'announcements', announcementId: notice.id })} />)}</div> : <p className="student-preview-empty-card">{announcementError ? 'Try again after checking your connection.' : 'No announcements match your search. Try another word or category.'}</p>}</section>
          <section className="student-preview-announcement-section student-preview-important-announcements"><div className="student-preview-section-heading"><div><p className="student-preview-overline">YOUR PERSONAL NOTICEBOARD</p><h2>Important announcements</h2></div><span className="student-preview-count">{pinnedIds.length}/10 saved</span></div>{pinnedItems.length ? <div className="student-preview-announcement-grid student-preview-announcement-list">{pinnedItems.map((item, index) => <AnnouncementCard key={item.id} item={item} listIndex={index + 1} pinned onTogglePin={togglePinned} onOpen={(notice) => navigate({ view: 'announcements', announcementId: notice.id })} />)}</div> : <p className="student-preview-empty-card">Pin notices below to save the ones you want to find quickly.</p>}</section>
        </div>
      </section>}

      {route.view === 'announcements' && route.announcementId && <section className="student-preview-detail-page"><button className="student-preview-back-link" onClick={() => navigate({ view: 'announcements' })} type="button">← Back to announcements</button>{!selectedAnnouncement ? loading ? <div className="student-preview-empty-card">Opening announcement…</div> : <div className="student-preview-empty-card">This announcement is no longer available in your school noticeboard.</div> : <article className="student-preview-detail-card"><div className="student-preview-detail-margin"><NoticeType kind={selectedAnnouncement.type} /><i /></div><div className="student-preview-detail-copy"><button className={'student-preview-detail-pin' + (pinnedIds.includes(selectedAnnouncement.id) ? ' is-pinned' : '')} onClick={() => togglePinned(selectedAnnouncement.id)} type="button" aria-label={pinnedIds.includes(selectedAnnouncement.id) ? 'Remove from important announcements' : 'Pin to important announcements'} aria-pressed={pinnedIds.includes(selectedAnnouncement.id)} title={pinnedIds.includes(selectedAnnouncement.id) ? 'Remove from important announcements' : 'Pin to important announcements'}><PushpinIcon /></button><h1>{selectedAnnouncement.title}</h1><div className="student-preview-detail-byline"><span className="student-preview-staff-avatar">{initials(selectedAnnouncement.authorDisplayName || 'School')}</span><span><strong>{selectedAnnouncement.authorDisplayName || 'Your school'}</strong><small>{stamp(selectedAnnouncement.createdAt)}</small></span></div><div className="student-preview-detail-body">{selectedAnnouncement.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{selectedAnnouncement.attachments?.length > 0 && <div className="student-preview-detail-attachments">{selectedAnnouncement.attachments.map((attachment) => <button key={attachment.id} onClick={() => void downloadAttachment(parentView ? `/api/parent/children/${parentStudentProfileId}/announcements/${selectedAnnouncement.id}/attachments/${attachment.id}` : `/api/student/announcements/${selectedAnnouncement.id}/attachments/${attachment.id}`, attachment)} type="button"><span aria-hidden="true">↳</span>{attachment.displayFilename}<small>{Math.round(attachment.size / 1024)} KB</small></button>)}</div>}</div></article>}</section>}

      {route.view === 'messages' && !route.conversationId && !route.newMessage && <section className="student-preview-page student-preview-messages-page"><div className="student-preview-page-heading student-preview-message-list-heading"><div><p className="student-preview-overline">SCHOOL CONVERSATIONS</p><h1>Messages</h1><p>Your conversations with teachers and school administrators.</p></div><BeaverMascot pose="message" hint="Mail for you" /><div className="student-preview-message-list-actions"><span className="student-preview-count">{unread} unread</span><button className="student-preview-primary-action" onClick={() => navigate({ view: 'messages', newMessage: true })} type="button"><span aria-hidden="true">＋</span> New message</button></div></div>{messageError && <p className="student-preview-load-error" role="alert">{messageError}</p>}{loading ? <p className="student-preview-empty-copy">Loading conversations…</p> : conversations.length === 0 ? <div className="student-preview-inbox-empty"><p>No conversations yet.</p><span>Start a note to a teacher or school administrator.</span></div> : <div className="student-preview-inbox-list">{conversations.map((message) => <button key={message.id} className="student-preview-inbox-row" onClick={() => navigate({ view: 'messages', conversationId: message.id })} type="button"><ConversationAvatar appearance={message.otherParticipantAppearance} name={message.otherParticipantDisplayName} /><span><strong>{message.otherParticipantDisplayName}</strong><small>{relativeRole(message.otherParticipantRole)}</small><em>{message.latestMessage || 'Open conversation'}</em></span><time>{stamp(message.lastMessageAt)}</time>{message.unreadCount > 0 && <i aria-label={`${message.unreadCount} unread messages`} />}</button>)}</div>}</section>}

      {route.view === 'messages' && route.newMessage && <section className="student-preview-page student-preview-new-message-page">
        <button className="student-preview-back-link" onClick={() => navigate({ view: 'messages' })} type="button">← Back to inbox</button>
        <div className="student-preview-new-message-layout">
          <div className="student-preview-new-message-aside">
            <p className="student-preview-overline">SCHOOL COMMUNITY</p>
            <h1>New message</h1>
            <p>Choose one person in your school and send a private note.</p>
            <div className="student-preview-compose-aside"><img src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><span><strong>One-to-one, school-safe messaging.</strong><small>Search teachers and school administrators by name or username.</small></span></div>
          </div>
          <form className="student-preview-compose-card" onSubmit={startConversation}>
            <div className="student-preview-compose-heading"><div><p className="student-preview-overline">RECIPIENT</p><h2>Choose one person</h2></div></div>
            <label className="student-preview-search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></svg><span className="sr-only">Search your school</span><input id="student-recipient-search" autoComplete="off" value={recipientQuery} onChange={(event) => { setRecipientQuery(event.target.value); setRecipients([]); setSelectedRecipient(null); setMessageError('') }} placeholder="Search by name or username" /></label>
            {messageError && <p className="student-preview-form-error" role="alert">{messageError}</p>}
            {recipientLoading && <p className="student-preview-compose-hint">Searching your school…</p>}
            {!selectedRecipient && recipientQuery.trim().length < 2 && <div className="student-preview-recipient-section"><p className="student-preview-recipient-section-title">RECENT CONVERSATIONS</p>{recentRecipients.length ? <div className="student-preview-recipient-list">{recentRecipients.map((recipient) => <button key={recipient.accountId + '-' + (recipient.studentProfileId ?? 'school')} onClick={() => setSelectedRecipient(recipient)} type="button"><span className="student-preview-staff-avatar">{initials(recipient.displayName)}</span><span><strong>{recipient.displayName}</strong><small>{relativeRole(recipient.role)}</small></span><i aria-hidden="true">＋</i></button>)}</div> : <p className="student-preview-compose-hint">Your recent conversations will appear here.</p>}</div>}
            {!selectedRecipient && recipientQuery.trim().length === 1 && <p className="student-preview-compose-hint">Enter at least two characters to search.</p>}
            {!selectedRecipient && recipientQuery.trim().length >= 2 && !recipientLoading && <div className="student-preview-recipient-section">{recipients.length ? <div className="student-preview-recipient-list">{recipients.map((recipient) => <button key={recipient.accountId} onClick={() => setSelectedRecipient(recipient)} type="button"><span className="student-preview-staff-avatar">{initials(recipient.displayName)}</span><span><strong>{recipient.displayName}</strong><small>{relativeRole(recipient.role)}</small></span><i aria-hidden="true">＋</i></button>)}</div> : !messageError && <p className="student-preview-compose-hint">No matching people were found in your school.</p>}</div>}
            {selectedRecipient && <>
              <div className="student-preview-selected-recipient"><span className="student-preview-staff-avatar">{initials(selectedRecipient.displayName)}</span><span><strong>{selectedRecipient.displayName}</strong><small>{relativeRole(selectedRecipient.role)}</small></span><button onClick={() => { setSelectedRecipient(null); setFirstMessage('') }} type="button">Change</button></div>
              <label className="student-preview-new-message-body" htmlFor="student-first-message">Message<textarea id="student-first-message" maxLength={5000} required rows={5} value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} placeholder={'Write a private message to ' + selectedRecipient.displayName + '…'} /><small>{firstMessage.length}/5000</small></label>
            </>}
            <div className="student-preview-new-message-actions"><button className="student-preview-compose-cancel" onClick={() => navigate({ view: 'messages' })} type="button">Cancel</button><button className="student-preview-primary-action" disabled={sending || !selectedRecipient || !firstMessage.trim()} type="submit">{sending ? 'Sending…' : 'Send message'}</button></div>
          </form>
        </div>
      </section>}      {route.view === 'messages' && route.conversationId && <section className="student-preview-page student-preview-thread-page">
        <button className="student-preview-back-link" onClick={() => navigate({ view: 'messages' })} type="button">← Back to inbox</button>
        {threadError && <p className="student-preview-form-error" role="alert">{threadError}</p>}
        <div className="student-preview-thread-layout">
          <aside className="student-preview-thread-sidebar"><p>YOUR CONVERSATIONS</p>{conversations.length ? <nav className="student-preview-thread-sidebar-list" aria-label="Your conversations">{conversations.map((message) => <button className={'student-preview-thread-sidebar-item' + (message.id === route.conversationId ? ' is-active' : '')} key={message.id} onClick={() => navigate({ view: 'messages', conversationId: message.id })} type="button" aria-current={message.id === route.conversationId ? 'page' : undefined}><ConversationAvatar appearance={message.otherParticipantAppearance} name={message.otherParticipantDisplayName} /><span><strong>{message.otherParticipantDisplayName}</strong><small>{message.latestMessage || relativeRole(message.otherParticipantRole)}</small></span>{message.unreadCount > 0 && <i aria-label={`${message.unreadCount} unread messages`} />}</button>)}</nav> : <div className="student-preview-thread-sidebar-empty">{loading ? 'Loading your conversations…' : 'Your previous conversations will appear here.'}</div>}</aside>
          {threadLoading ? <div className="student-preview-empty-card">Opening conversation…</div> : thread && <div className="student-preview-thread-card">
            <header><div><p className="student-preview-overline">SCHOOL CONVERSATION</p><h1>{selectedConversation?.otherParticipantDisplayName || 'Conversation'}</h1><small>{relativeRole(selectedConversation?.otherParticipantRole || 'SCHOOL')}</small></div></header>
            <div className="student-preview-thread-messages">{thread.messages.map((message) => <article className={'student-preview-message-bubble' + (message.senderAccountId === profile.userAccountId ? ' is-own' : '')} key={message.id}><ConversationAvatar appearance={message.senderAccountId === profile.userAccountId ? appearance : selectedConversation?.otherParticipantAppearance} name={message.senderDisplayName} /><p>{message.message}</p>{message.attachments?.length > 0 && <div className="student-preview-message-attachments">{message.attachments.map((attachment) => <button key={attachment.id} onClick={() => void downloadAttachment(`/api/messages/conversations/${route.conversationId}/messages/${message.id}/attachments/${attachment.id}${parentStudentProfileId === undefined ? '' : '?studentProfileId=' + parentStudentProfileId}`, attachment)} type="button"><span aria-hidden="true">↳</span>{attachment.displayFilename}<small>{Math.round(attachment.size / 1024)} KB</small></button>)}</div>}<small>{message.senderDisplayName}{message.parentAuthored ? ' · Parent' : ''} · {stamp(message.createdAt)}</small></article>)}</div>
            {thread.conversation.readOnly ? <p className="student-preview-empty-copy">This conversation is read-only.</p> : <form className="student-preview-reply-form" onSubmit={sendReply}><label className="sr-only" htmlFor="student-message-reply">Your message</label><textarea id="student-message-reply" maxLength={5000} rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…" /><button className="student-preview-primary-action" disabled={sending || !reply.trim()} type="submit">{sending ? 'Sending…' : 'Send message'}</button></form>}
          </div>}
        </div>
      </section>}      {route.view === 'profile' && <CampusMemberWorkspace embedded theme={theme} token={token} profile={profile} initialAppearance={appearance} onToggleTheme={onToggleTheme} onSignOut={onSignOut} onSessionExpired={handleSessionExpired} onAppearanceChange={setAppearance} onReturnHome={() => navigate({ view: 'today' })} onOpenMessages={() => navigate({ view: 'messages' })} onOpenAnnouncements={() => navigate({ view: 'announcements' })} />}
    </div>

    <footer className="student-preview-footer"><strong>ClassBridge</strong><span>•</span><span>A more connected school community</span></footer>
    {transitionLabel && <WorkspaceTransition tone="student" />}
    {toast && <aside className="student-preview-error-toast" role="alert"><img src="/images/beaver-error-cutout.png" alt="" /><div><strong>Something went wrong</strong><p>{toast}</p></div><button aria-label="Dismiss error" onClick={dismissErrorToast} type="button">×</button></aside>}
    {(confirmParentReturn || parentView?.confirmReturn) && parentView && <div className="student-preview-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setConfirmParentReturn(false); parentView.onCancelReturn?.() } }} role="presentation"><section className="student-preview-confirm-card student-preview-parent-return-card" aria-labelledby="student-parent-return-title" aria-modal="true" role="dialog"><button className="student-preview-modal-close" onClick={() => { setConfirmParentReturn(false); parentView.onCancelReturn?.() }} type="button" aria-label="Close">×</button><img src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><p className="student-preview-overline">SWITCHING WORKSPACES</p><h2 id="student-parent-return-title">Return to your parent home?</h2><p>You’ll leave {childName}’s school view and return to the list of your children.</p><div><button className="student-preview-parent-cancel" onClick={() => { setConfirmParentReturn(false); parentView.onCancelReturn?.() }} type="button">Stay here</button><button className="student-preview-primary-action" onClick={parentView.onReturnToParent} type="button">Return to parent home</button></div></section></div>}
    {confirmSignOut && <div className="student-preview-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSignOut(false) }} role="presentation"><section className="student-preview-confirm-card student-preview-signout-card" aria-labelledby="student-signout-title" aria-modal="true" role="dialog"><button className="student-preview-modal-close" onClick={() => setConfirmSignOut(false)} type="button" aria-label="Close">×</button><img src="/images/beaver-signout-cutout.png" alt="ClassBridge beaver looks unsure about leaving" /><p className="student-preview-overline">BEFORE YOU HEAD OUT</p><h2 id="student-signout-title">Ready to leave, {parentView ? (profile.firstName || profile.username) : greeting}?</h2><p>You can come back to your school space whenever you’re ready.</p><div><button className="student-preview-text-action" onClick={() => setConfirmSignOut(false)} type="button">Stay here</button><button className="student-preview-primary-action" onClick={onSignOut} type="button">Sign out</button></div></section></div>}
    {sessionExpired && <div className="student-preview-modal-backdrop student-session-expired-backdrop" role="presentation"><section className="student-preview-confirm-card student-session-expired-card" aria-labelledby="student-session-expired-title" aria-modal="true" role="dialog"><img src="/images/beaver-session-expired.png" alt="The ClassBridge beaver holds an hourglass" /><p className="student-preview-overline">A QUICK PAUSE</p><h2 id="student-session-expired-title">Your session has expired</h2><p>Please sign in again to continue to your school workspace.</p><div><button className="student-preview-primary-action" onClick={onSessionExpired} type="button">Back to sign in</button></div></section></div>}
  </main>
}
