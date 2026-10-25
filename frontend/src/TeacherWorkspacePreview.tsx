import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { ThemeMode } from './LoginExperience'
import { fetchDeduplicated } from './apiClient'
import SchoolSuppliesPattern from './SchoolSuppliesPattern'
import WorkspaceTransition from './WorkspaceTransition'
import './TeacherWorkspacePreview.css'

type Profile = { userAccountId: number; username: string; firstName: string; lastName: string; email?: string | null; emailVerified?: boolean; role?: string; phoneNumber?: string | null }
type TargetClassroom = { id?: number; classroomId?: number; gradeLevel: number; sectionName: string }
type AnnouncementType = 'GENERAL' | 'HOMEWORK' | 'EXAM' | 'EVENT' | 'EXAM_RESULTS'
type Attachment = { id: number; displayFilename: string; contentType: string; size: number; createdAt?: string }
type AccountAppearance = { avatarType: AvatarType; animal: string | null; imageDataUrl: string | null }
type Announcement = { id: number; title: string; body: string; type: AnnouncementType; authorDisplayName: string; targetClassrooms: TargetClassroom[]; attachments: Attachment[]; createdAt: string }
type Conversation = { id: number; schoolId: number; studentProfileId: number | null; studentDisplayName: string | null; otherParticipantAccountId: number; otherParticipantDisplayName: string; otherParticipantRole: string; otherParticipantAppearance?: AccountAppearance; readOnly: boolean; unreadCount: number; latestMessage: string | null; lastMessageAt: string }
type DirectMessage = { id: number; senderAccountId: number; senderDisplayName: string; message: string; createdAt: string; attachments: Attachment[] }
type ConversationDetail = { conversation: Conversation; messages: DirectMessage[] }
type Classroom = { id: number; gradeLevel: number; sectionName: string }
type Student = { id: number; schoolNumber: string; firstName: string; lastName: string; classroomId: number; gradeLevel: number; sectionName: string }
type MessageRecipient = { accountId: number; role: string; displayName: string; studentProfileId: number | null; schoolNumber: string | null; schoolId: number }
type ClassroomDetail = Classroom & { students: Student[] }
type Route = { page: 'today' | 'profile' | 'announcements' | 'announcement-detail' | 'new-announcement' | 'messages' | 'new-message' | 'classes' | 'class-detail'; conversationId?: number; announcementId?: number; classroomId?: number }
type AvatarType = 'INITIALS' | 'ANIMAL' | 'PHOTO'
type Props = { theme: ThemeMode; token: string; profile: Profile; onToggleTheme: () => void; onSignOut: () => void; onSessionExpired: () => void }

const routeHash = (route: Route) => route.conversationId ? '#teacher/messages/' + route.conversationId : route.announcementId ? '#teacher/announcements/' + route.announcementId : route.classroomId ? '#teacher/classes/' + route.classroomId : ({ today: '#teacher', profile: '#teacher/profile', announcements: '#teacher/announcements', 'announcement-detail': '#teacher/announcements', 'new-announcement': '#teacher/announcements/new', messages: '#teacher/messages', 'new-message': '#teacher/messages/new', classes: '#teacher/classes', 'class-detail': '#teacher/classes' } as const)[route.page]
function readRoute(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/')
  if (parts[0] !== 'teacher') return { page: 'today' }
  if (parts[1] === 'profile') return { page: 'profile' }
  if (parts[1] === 'announcements' && parts[2] === 'new') return { page: 'new-announcement' }
  if (parts[1] === 'announcements' && Number(parts[2]) > 0) return { page: 'announcement-detail', announcementId: Number(parts[2]) }
  if (parts[1] === 'announcements') return { page: 'announcements' }
  if (parts[1] === 'messages' && parts[2] === 'new') return { page: 'new-message' }
  if (parts[1] === 'messages' && Number(parts[2]) > 0) return { page: 'messages', conversationId: Number(parts[2]) }
  if (parts[1] === 'messages') return { page: 'messages' }
  if (parts[1] === 'classes' && Number(parts[2]) > 0) return { page: 'class-detail', classroomId: Number(parts[2]) }
  if (parts[1] === 'classes') return { page: 'classes' }
  return { page: 'today' }
}

const announcementCategories: { value: AnnouncementType; title: string; description: string; mark: string }[] = [
  { value: 'GENERAL', title: 'General notice', description: 'School-wide or class update', mark: 'leaf' },
  { value: 'HOMEWORK', title: 'Homework notice', description: 'Reading, practice or class preparation', mark: 'book' },
  { value: 'EXAM', title: 'Exam announcement', description: 'Upcoming exam information', mark: 'pencil' },
  { value: 'EVENT', title: 'School event', description: 'Meeting, trip or activity', mark: 'bell' },
  { value: 'EXAM_RESULTS', title: 'Exam results', description: 'Results and next steps', mark: 'star' },
]

type ProfileAnimal = { id: string; name: string; group: 'adult' | 'student'; column: number; row: number }
const profileAnimalSpecies = ['Lion', 'Bear', 'Koala', 'Turtle', 'Owl', 'Hippo', 'Snake', 'Fox', 'Rabbit', 'Otter', 'Cheetah']
const ANNOUNCEMENT_CACHE_MS = 60_000
const CONVERSATION_CACHE_MS = 30_000
const CLASSROOM_CACHE_MS = 5 * 60_000
const profileAnimalOptions: ProfileAnimal[] = profileAnimalSpecies.flatMap((name, index) => (['adult', 'student'] as const).map((group) => ({
  id: name.toUpperCase() + '_' + group.toUpperCase(), name, group, column: index % 4, row: Math.floor(index / 4),
})))
function profileAnimalArt(animal: ProfileAnimal) {
  // The portrait sheets are square images arranged in four columns and three rows.
  // These positions align each row's top edge inside the square avatar crop.
  const rowPosition = ['0%', '44.44%', '88.89%'][animal.row] ?? '0%'
  return {
    backgroundImage: `url('/images/profile-animals-${animal.group === 'adult' ? 'adults' : 'students'}.jpg')`,
    backgroundSize: '400% 400%',
    backgroundPosition: `${(animal.column / 3) * 100}% ${rowPosition}`,
  }
}

class ApiError extends Error { readonly status: number; constructor(message: string, status: number) { super(message); this.status = status } }
async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', 'Bearer ' + token); headers.set('Accept', 'application/json')
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json')
  const response = await fetchDeduplicated(path, { ...init, headers })
  const text = await response.text(); let payload: any = null
  if (text) { try { payload = JSON.parse(text) } catch { payload = null } }
  if (!response.ok) throw new ApiError(payload?.message || 'The request could not be completed (' + response.status + ').', response.status)
  return payload as T
}
function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CB' }
function stamp(value?: string | null) {
  if (!value) return 'Recently'
  const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toDateString() === new Date().toDateString()
    ? 'Today · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function classroomId(target: TargetClassroom) { return target.classroomId ?? target.id }
function classroomName(room: Classroom) { return 'Grade ' + room.gradeLevel + ' · ' + room.sectionName }
function categoryLabel(type?: AnnouncementType) { return ({ GENERAL: 'General notice', HOMEWORK: 'Homework notice', EXAM: 'Exam announcement', EVENT: 'School event', EXAM_RESULTS: 'Exam results' } as const)[type || 'GENERAL'] }
function audience(item: Announcement) { return item.targetClassrooms?.length ? (item.targetClassrooms.length === 1 ? 'Grade ' : 'Grades ') + item.targetClassrooms.map((room) => room.gradeLevel + '-' + room.sectionName).join(', ') : 'School notice' }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.' }
function attachmentSize(size: number) { return size < 1024 * 1024 ? Math.max(1, Math.round(size / 1024)) + ' KB' : (size / (1024 * 1024)).toFixed(1) + ' MB' }
function categoryIllustration(mark: string) {
  if (mark === 'book') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5c4.2-1.6 8.1-.7 11 1.6v17c-3-2.3-6.8-3.2-11-1.6v-17Zm22 0c-4.2-1.6-8.1-.7-11 1.6v17c3-2.3 6.8-3.2 11-1.6v-17Z" /><path d="M9 12h3m-3 4h3m8-4h3m-3 4h3" /></svg>
  if (mark === 'pencil') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m7 22 13-13 5 5-13 13-6 1 1-6Z" /><path d="m18 11 5 5M7 22l5 5M6 29h20" /></svg>
  if (mark === 'bell') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 22h16l-2-3v-6a6 6 0 0 0-12 0v6l-2 3Z" /><path d="M13 25a3 3 0 0 0 6 0M16 6V4" /></svg>
  if (mark === 'star') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 4 3.6 7.4 8.2 1.2-5.9 5.8 1.4 8.2-7.3-3.9-7.3 3.9 1.4-8.2-5.9-5.8 8.2-1.2L16 4Z" /></svg>
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27s-11-6.3-11-14a6 6 0 0 1 11-3.4A6 6 0 0 1 27 13c0 7.7-11 14-11 14Z" /><path d="M8 18h5l2-4 3 7 2-4h4" /></svg>
}
export default function TeacherWorkspacePreview({ theme, token, profile, onToggleTheme, onSignOut, onSessionExpired }: Props) {
  const [route, setRoute] = useState<Route>(readRoute)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [authoredAnnouncements, setAuthoredAnnouncements] = useState<Announcement[]>([])
  const [announcementDetail, setAnnouncementDetail] = useState<Announcement | null>(null)
  const [announcementDetailLoading, setAnnouncementDetailLoading] = useState(false)
  const [announcementDetailError, setAnnouncementDetailError] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const readConversationIds = useRef(new Map<number, number>())
  const conversationDetailCache = useRef(new Map<number, { detail: ConversationDetail; fetchedAt: number }>())
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [homeroomClassrooms, setHomeroomClassrooms] = useState<Classroom[]>([])
  const [classroomDetail, setClassroomDetail] = useState<ClassroomDetail | null>(null)
  const [classDetailLoading, setClassDetailLoading] = useState(false)
  const [classDetailError, setClassDetailError] = useState('')
  const [announcementError, setAnnouncementError] = useState('')
  const [announcementHistoryError, setAnnouncementHistoryError] = useState('')
  const [conversationError, setConversationError] = useState('')
  const [classroomError, setClassroomError] = useState('')
  const [homeroomError, setHomeroomError] = useState('')
  const [loading, setLoading] = useState(true)
  const conversationsLoaded = useRef(false)
  const fetchedAt = useRef({ announcements: 0, announcementHistory: 0, conversations: 0, classrooms: 0, homeroom: 0 })
  const previousPage = useRef(route.page)
  const [filter, setFilter] = useState('all')
  const [announcementQuery, setAnnouncementQuery] = useState('')
  const [announcementTypeFilter, setAnnouncementTypeFilter] = useState<'all' | AnnouncementType>('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<AnnouncementType>('GENERAL')
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([])
  const [announcementFiles, setAnnouncementFiles] = useState<File[]>([])
  const [posting, setPosting] = useState(false)
  const postingRef = useRef(false)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipients, setRecipients] = useState<MessageRecipient[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<MessageRecipient | null>(null)
  const [recipientLoading, setRecipientLoading] = useState(false)
  const [recipientError, setRecipientError] = useState('')
  const [newMessageDraft, setNewMessageDraft] = useState('')
  const [sendingNewMessage, setSendingNewMessage] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [accountAppearance, setAccountAppearance] = useState<AccountAppearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceDraft, setAppearanceDraft] = useState<AccountAppearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceSaving, setAppearanceSaving] = useState(false)
  const [successToast, setSuccessToast] = useState('')
  const [emailDraft, setEmailDraft] = useState(profile.email || '')
  const [savedEmail, setSavedEmail] = useState(profile.email || '')
  const [emailVerified, setEmailVerified] = useState(Boolean(profile.emailVerified))
  const [phoneDraft, setPhoneDraft] = useState(profile.phoneNumber || '')
  const [savedPhone, setSavedPhone] = useState(profile.phoneNumber || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [transitionLabel, setTransitionLabel] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [errorToast, setErrorToast] = useState('')
  const navigationTimer = useRef<number | null>(null)
  const errorToastTimer = useRef<number | null>(null)
  const successToastTimer = useRef<number | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  function handleSessionExpired() { setSessionExpired(true) }
  function notifyError(message: string) {
    setErrorToast(message)
    if (errorToastTimer.current) window.clearTimeout(errorToastTimer.current)
    if (successToastTimer.current) window.clearTimeout(successToastTimer.current)
    successToastTimer.current = null
    setSuccessToast('')
    errorToastTimer.current = window.setTimeout(() => { setErrorToast(''); errorToastTimer.current = null }, 7000)
  }
  function dismissErrorToast() {
    if (errorToastTimer.current) window.clearTimeout(errorToastTimer.current)
    errorToastTimer.current = null
    setErrorToast('')
  }
  function notifySuccess(message: string) {
    setSuccessToast(message)
    if (successToastTimer.current) window.clearTimeout(successToastTimer.current)
    if (errorToastTimer.current) window.clearTimeout(errorToastTimer.current)
    errorToastTimer.current = null
    setErrorToast('')
    successToastTimer.current = window.setTimeout(() => { setSuccessToast(''); successToastTimer.current = null }, 4000)
  }
  function dismissSuccessToast() {
    if (successToastTimer.current) window.clearTimeout(successToastTimer.current)
    successToastTimer.current = null
    setSuccessToast('')
  }

  useEffect(() => {
    const sync = () => {
      if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
      const next = readRoute()
      setTransitionLabel('Loading…')
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      navigationTimer.current = window.setTimeout(() => { setRoute(next); setTransitionLabel(''); navigationTimer.current = null; window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }) }, reducedMotion ? 0 : 700)
    }
    window.addEventListener('popstate', sync); window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])
  useEffect(() => () => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
    if (errorToastTimer.current) window.clearTimeout(errorToastTimer.current)
    if (successToastTimer.current) window.clearTimeout(successToastTimer.current)
  }, [])
  useEffect(() => {
    function outside(event: MouseEvent) { if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false) }
    document.addEventListener('mousedown', outside); return () => document.removeEventListener('mousedown', outside)
  }, [])
  useEffect(() => {
    function closeSignOut(event: KeyboardEvent) { if (event.key === 'Escape') setConfirmSignOut(false) }
    document.addEventListener('keydown', closeSignOut)
    return () => document.removeEventListener('keydown', closeSignOut)
  }, [])
  useEffect(() => {
    let current = true
    const enteringMessages = route.page === 'messages' && previousPage.current !== 'messages'
    previousPage.current = route.page
    const now = Date.now()
    const shouldLoadAnnouncements = route.page === 'today' && now - fetchedAt.current.announcements >= ANNOUNCEMENT_CACHE_MS
    const shouldLoadHistory = route.page === 'announcements' && now - fetchedAt.current.announcementHistory >= ANNOUNCEMENT_CACHE_MS
    const shouldLoadConversations = !conversationsLoaded.current || (enteringMessages && now - fetchedAt.current.conversations >= CONVERSATION_CACHE_MS)
    const shouldLoadClassrooms = (route.page === 'today' || route.page === 'new-announcement') && now - fetchedAt.current.classrooms >= CLASSROOM_CACHE_MS
    const shouldLoadHomeroom = (route.page === 'today' || route.page === 'classes') && now - fetchedAt.current.homeroom >= CLASSROOM_CACHE_MS
    const hasRequests = shouldLoadAnnouncements || shouldLoadHistory || shouldLoadConversations || shouldLoadClassrooms || shouldLoadHomeroom
    if (!hasRequests) {
      setLoading(false)
      return
    }
    setLoading(true)
    if (shouldLoadAnnouncements) setAnnouncementError('')
    if (shouldLoadHistory) setAnnouncementHistoryError('')
    if (shouldLoadConversations) setConversationError('')
    if (shouldLoadClassrooms) setClassroomError('')
    if (shouldLoadHomeroom) setHomeroomError('')
    const announcementsRequest = shouldLoadAnnouncements ? api<Announcement[]>('/api/announcements', token) : Promise.resolve(null)
    const historyRequest = shouldLoadHistory ? api<Announcement[]>('/api/announcements/created-by-user', token) : Promise.resolve(null)
    const conversationsRequest = shouldLoadConversations ? api<Conversation[]>('/api/messages/conversations', token) : Promise.resolve(null)
    const classroomsRequest = shouldLoadClassrooms ? api<Classroom[]>('/api/teacher/classrooms', token) : Promise.resolve(null)
    const homeroomRequest = shouldLoadHomeroom ? api<Classroom[]>('/api/teacher/classrooms/homeroom', token) : Promise.resolve(null)
    Promise.allSettled([
      announcementsRequest,
      historyRequest,
      conversationsRequest,
      classroomsRequest,
      homeroomRequest,
    ]).then(([announcementsResult, announcementHistoryResult, conversationsResult, classroomsResult, homeroomResult]) => {
      if (!current) return
      const results = [announcementsResult, announcementHistoryResult, conversationsResult, classroomsResult, homeroomResult]
      if (results.some((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401)) { handleSessionExpired(); return }
      if (announcementsResult.status === 'fulfilled' && announcementsResult.value) {
        fetchedAt.current.announcements = Date.now()
        setAnnouncements(announcementsResult.value.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
      }
      else if (announcementsResult.status === 'rejected') setAnnouncementError(errorText(announcementsResult.reason))
      if (announcementHistoryResult.status === 'fulfilled' && announcementHistoryResult.value) {
        fetchedAt.current.announcementHistory = Date.now()
        setAuthoredAnnouncements(announcementHistoryResult.value.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
      }
      else if (announcementHistoryResult.status === 'rejected') setAnnouncementHistoryError(errorText(announcementHistoryResult.reason))
      if (conversationsResult.status === 'fulfilled' && conversationsResult.value) {
        conversationsLoaded.current = true
        fetchedAt.current.conversations = Date.now()
        setConversations(conversationsResult.value.map((item) => { const readAt = readConversationIds.current.get(item.id); return readAt !== undefined && Date.parse(item.lastMessageAt) <= readAt ? { ...item, unreadCount: 0 } : item }).slice().sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)))
      } else if (conversationsResult.status === 'rejected') setConversationError(errorText(conversationsResult.reason))
      if (classroomsResult.status === 'fulfilled' && classroomsResult.value) {
        fetchedAt.current.classrooms = Date.now()
        setClassrooms(classroomsResult.value.slice().sort((a, b) => a.gradeLevel - b.gradeLevel || a.sectionName.localeCompare(b.sectionName)))
      }
      else if (classroomsResult.status === 'rejected' && classroomsResult.reason instanceof ApiError && classroomsResult.reason.status === 404) setClassroomError('The classroom directory is missing from the running API. Restart the backend with this teacher-workspace branch.')
      else if (classroomsResult.status === 'rejected') setClassroomError(errorText(classroomsResult.reason))
      if (homeroomResult.status === 'fulfilled' && homeroomResult.value) {
        fetchedAt.current.homeroom = Date.now()
        setHomeroomClassrooms(homeroomResult.value.slice().sort((a, b) => a.gradeLevel - b.gradeLevel || a.sectionName.localeCompare(b.sectionName)))
      }
      else if (homeroomResult.status === 'rejected' && homeroomResult.reason instanceof ApiError && homeroomResult.reason.status === 404) setHomeroomError('Homeroom classes are not available in the running API yet. Restart the backend with this teacher-workspace branch.')
      else if (homeroomResult.status === 'rejected') setHomeroomError(errorText(homeroomResult.reason))
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [route.page, token])
  useEffect(() => {
    const query = recipientQuery.trim()
    if (route.page !== 'new-message' || selectedRecipient || query.length < 2) { setRecipients([]); setRecipientError(''); return }
    let current = true
    const timer = window.setTimeout(() => {
      setRecipientLoading(true); setRecipientError('')
      api<MessageRecipient[]>('/api/messages/recipients?query=' + encodeURIComponent(query), token)
        .then((value) => { if (current) setRecipients(value ?? []) })
        .catch((error) => { if (!current) return; if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else setRecipientError(errorText(error)) })
        .finally(() => { if (current) setRecipientLoading(false) })
    }, 250)
    return () => { current = false; window.clearTimeout(timer) }
  }, [route.page, recipientQuery, selectedRecipient, token])
  useEffect(() => {
    if (!route.classroomId) { setClassroomDetail(null); setClassDetailError(''); return }
    let current = true; setClassDetailLoading(true); setClassDetailError('')
    api<ClassroomDetail>('/api/teacher/classrooms/' + route.classroomId, token)
      .then((value) => { if (current) setClassroomDetail(value) })
      .catch((error) => { if (!current) return; if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else setClassDetailError(errorText(error)) })
      .finally(() => { if (current) setClassDetailLoading(false) })
    return () => { current = false }
  }, [route.classroomId, token])
  useEffect(() => {
    if (!route.conversationId) { setDetail(null); setThreadError(''); return }
    const conversationId = route.conversationId
    const cached = conversationDetailCache.current.get(conversationId)
    const listedConversation = conversations.find((item) => item.id === conversationId)
    const cacheMatchesList = !listedConversation || listedConversation.lastMessageAt === cached?.detail.conversation.lastMessageAt
    if (cached && Date.now() - cached.fetchedAt < CONVERSATION_CACHE_MS && cacheMatchesList) {
      const readAt = cached.detail.messages.reduce((latest, message) => Math.max(latest, Date.parse(message.createdAt) || 0), 0)
      readConversationIds.current.set(conversationId, readAt)
      setDetail(cached.detail)
      setThreadError('')
      setThreadLoading(false)
      return
    }
    let current = true; setThreadLoading(true); setThreadError('')
    api<ConversationDetail>('/api/messages/conversations/' + conversationId, token)
      .then((value) => { if (current) { const readAt = value.messages.reduce((latest, message) => Math.max(latest, Date.parse(message.createdAt) || 0), 0); readConversationIds.current.set(conversationId, readAt); conversationDetailCache.current.set(conversationId, { detail: value, fetchedAt: Date.now() }); setDetail(value); setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, latestMessage: value.conversation.latestMessage, lastMessageAt: value.conversation.lastMessageAt, unreadCount: 0 } : item)) } })
      .catch((error) => { if (!current) return; if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else setThreadError(errorText(error)) })
      .finally(() => { if (current) setThreadLoading(false) })
    return () => { current = false }
  }, [route.conversationId, token, conversations])

  const classFilteredAnnouncements = useMemo(() => {
    const source = route.page === 'announcements' ? authoredAnnouncements : announcements
    return route.page === 'announcements' || filter === 'all' ? source : source.filter((item) => item.targetClassrooms?.some((room) => String(classroomId(room)) === filter))
  }, [announcements, authoredAnnouncements, filter, route.page])
  const visibleAnnouncements = useMemo(() => {
    if (route.page !== 'announcements') return classFilteredAnnouncements
    const query = announcementQuery.trim().toLocaleLowerCase()
    return classFilteredAnnouncements.filter((item) => (announcementTypeFilter === 'all' || item.type === announcementTypeFilter)
      && (!query || [item.title, item.body, item.authorDisplayName, audience(item)].some((value) => value?.toLocaleLowerCase().includes(query))))
  }, [classFilteredAnnouncements, announcementQuery, announcementTypeFilter, route.page])
  const recentRecipients = useMemo<MessageRecipient[]>(() => {
    const seen = new Set<number>()
    return conversations.flatMap((item) => {
      if (seen.has(item.otherParticipantAccountId)) return []
      seen.add(item.otherParticipantAccountId)
      return [{
        accountId: item.otherParticipantAccountId,
        role: item.otherParticipantRole,
        displayName: item.otherParticipantDisplayName,
        studentProfileId: item.studentProfileId,
        schoolNumber: null,
        schoolId: item.schoolId,
      }]
    }).slice(0, 3)
  }, [conversations])
  const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0)
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username
  const greetingName = profile.firstName || profile.username
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const selectedConversation = detail?.conversation ?? conversations.find((item) => item.id === route.conversationId) ?? null
  const selectedAnnouncement = announcementDetail?.id === route.announcementId
    ? announcementDetail
    : announcements.find((item) => item.id === route.announcementId) ?? authoredAnnouncements.find((item) => item.id === route.announcementId) ?? null
  const selectedProfileAnimal = (value: AccountAppearance) => profileAnimalOptions.find((animal) => animal.id === value.animal)

  useEffect(() => {
    if (route.page !== 'announcement-detail' || !route.announcementId) {
      setAnnouncementDetail(null)
      setAnnouncementDetailError('')
      setAnnouncementDetailLoading(false)
      return
    }
    const cached = announcements.find((item) => item.id === route.announcementId)
      ?? authoredAnnouncements.find((item) => item.id === route.announcementId)
    if (cached) {
      setAnnouncementDetail(cached)
      setAnnouncementDetailError('')
      setAnnouncementDetailLoading(false)
      return
    }
    let current = true
    setAnnouncementDetail(null)
    setAnnouncementDetailError('')
    setAnnouncementDetailLoading(true)
    api<Announcement>('/api/announcements/' + route.announcementId, token)
      .then((value) => { if (current) setAnnouncementDetail(value) })
      .catch((error) => { if (!current) return; if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else setAnnouncementDetailError(errorText(error)) })
      .finally(() => { if (current) setAnnouncementDetailLoading(false) })
    return () => { current = false }
  }, [route.page, route.announcementId, announcements, authoredAnnouncements, token])

  useEffect(() => {
    let current = true
    api<AccountAppearance>('/api/auth/appearance', token)
      .then((value) => { if (current) { setAccountAppearance(value); setAppearanceDraft(value) } })
      .catch((error) => { if (current && error instanceof ApiError && error.status === 401) handleSessionExpired() })
    return () => { current = false }
  }, [token])

  function accountAvatar(value: AccountAppearance, className = '', fallback = fullName) {
    const animal = selectedProfileAnimal(value)
    return <span className={'teacher-user-avatar teacher-account-avatar ' + className + ' avatar-' + value.avatarType.toLowerCase()} aria-hidden="true">
      {value.avatarType === 'PHOTO' && value.imageDataUrl ? <img src={value.imageDataUrl} alt="" /> : value.avatarType === 'ANIMAL' && animal ? <span className="teacher-account-animal-art" style={profileAnimalArt(animal)} /> : initials(fallback)}
    </span>
  }

  function participantAvatar(value: AccountAppearance | undefined, name: string, className = '') {
    const portrait = value ?? { avatarType: 'INITIALS' as const, animal: null, imageDataUrl: null }
    const animal = selectedProfileAnimal(portrait)
    return <span className={'teacher-conversation-avatar ' + className + ' teacher-participant-avatar'} aria-hidden="true">{portrait.avatarType === 'PHOTO' && portrait.imageDataUrl ? <img src={portrait.imageDataUrl} alt="" /> : portrait.avatarType === 'ANIMAL' && animal ? <span style={profileAnimalArt(animal)} /> : initials(name)}</span>
  }

  async function saveAppearance() {
    setAppearanceSaving(true)
    try {
      const saved = await api<AccountAppearance>('/api/auth/appearance', token, { method: 'PUT', body: JSON.stringify(appearanceDraft) })
      setAccountAppearance(saved); setAppearanceDraft(saved); notifySuccess('Your avatar has been saved to your account.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setAppearanceSaving(false) }
  }

  function selectAvatarFile(event: ChangeEvent<HTMLInputElement>) {
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
    if (!emailDraft.trim()) { notifyError('Enter an email address first.'); return }
    if (emailDraft.trim().toLocaleLowerCase() === savedEmail.trim().toLocaleLowerCase()) { notifySuccess('This email address is already saved.'); return }
    setProfileSaving(true)
    try {
      await api('/api/auth/email', token, { method: 'PUT', body: JSON.stringify({ email: emailDraft.trim() }) })
      setSavedEmail(emailDraft.trim()); setEmailVerified(false); setVerificationSent(false); setVerificationCode(''); notifySuccess('Email saved. Verify it before using it for password recovery.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setProfileSaving(false) }
  }

  async function sendVerificationCode() {
    setProfileSaving(true)
    try {
      await api('/api/auth/email-verification/request', token, { method: 'POST' })
      setVerificationSent(true); notifySuccess('A six-digit code has been sent to your email.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setProfileSaving(false) }
  }

  async function confirmVerification(event: FormEvent) {
    event.preventDefault(); setProfileSaving(true)
    try {
      await api<void>('/api/auth/email-verification/confirm', token, { method: 'POST', body: JSON.stringify({ code: verificationCode }) })
      setEmailVerified(true); setVerificationSent(false); setVerificationCode(''); notifySuccess('Your email address is verified.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setProfileSaving(false) }
  }

  async function savePhone() {
    setProfileSaving(true)
    try {
      const updated = await api<Profile>('/api/auth/phone', token, { method: 'PUT', body: JSON.stringify({ phoneNumber: phoneDraft.trim() }) })
      const savedNumber = updated.phoneNumber || phoneDraft.trim()
      setPhoneDraft(savedNumber); setSavedPhone(savedNumber); notifySuccess('Your phone number has been updated.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setProfileSaving(false) }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8 || newPassword.length > 20) { notifyError('Your new password must be 8 to 20 characters long.'); return }
    if (newPassword !== passwordConfirmation) { notifyError('The new password and confirmation do not match.'); return }
    setPasswordSaving(true)
    try {
      await api<void>('/api/auth/change-password', token, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
      setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation('')
      handleSessionExpired()
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setPasswordSaving(false) }
  }

  function navigate(next: Route, replace = false) {
    const hash = routeHash(next)
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
    setProfileOpen(false)
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
  function openNewAnnouncement() { setTitle(''); setBody(''); setCategory('GENERAL'); setAnnouncementFiles([]); setSelectedClassrooms([]); navigate({ page: 'new-announcement' }) }
  function handleAnnouncementFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!picked.length) return
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png'])
    const invalid = picked.find((file) => !allowed.has(file.type) || file.size > 10 * 1024 * 1024)
    if (invalid) { notifyError(invalid.size > 10 * 1024 * 1024 ? `${invalid.name} is larger than 10 MB.` : `${invalid.name} is not a supported PDF, JPG or PNG file.`); return }
    const merged = [...announcementFiles]
    for (const file of picked) if (!merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) merged.push(file)
    if (merged.length > 5) { notifyError('An announcement can include up to five files.'); return }
    setAnnouncementFiles(merged)
  }
  function toggleClassroom(id: number) { const value = String(id); setSelectedClassrooms((old) => old.includes(value) ? old.filter((item) => item !== value) : [...old, value]) }
  function selectAllClassrooms(checked: boolean) { setSelectedClassrooms(checked ? classrooms.map((room) => String(room.id)) : []) }
  async function uploadFile(path: string, file: File) {
    const form = new FormData(); form.append('file', file)
    return api<Attachment>(path, token, { method: 'POST', body: form })
  }
  async function downloadFile(path: string, filename: string) {
    try {
      const response = await fetch(path, { headers: { Authorization: 'Bearer ' + token } })
      if (!response.ok) { if (response.status === 401) { handleSessionExpired(); return }; throw new Error('This file could not be downloaded.') }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url)
    } catch (error) { notifyError('This file could not be downloaded. ' + errorText(error)) }
  }
  function rememberPublishedAnnouncement(announcement: Announcement) {
    const item = { ...announcement, attachments: announcement.attachments ?? [] }
    const newestFirst = (items: Announcement[]) => [...items.filter((existing) => existing.id !== item.id), item]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    setAnnouncements(newestFirst)
    setAuthoredAnnouncements(newestFirst)
    const now = Date.now()
    fetchedAt.current.announcements = now
    fetchedAt.current.announcementHistory = now
  }
  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !body.trim() || selectedClassrooms.length === 0 || postingRef.current) return
    postingRef.current = true
    setPosting(true)
    let savedAnnouncement: Announcement | null = null
    const uploadedAttachments: Attachment[] = []
    try {
      savedAnnouncement = await api<Announcement>('/api/announcements', token, { method: 'POST', body: JSON.stringify({ title: title.trim(), body: body.trim(), type: category, targetClassroomIds: selectedClassrooms.map(Number) }) })
      for (const file of announcementFiles) uploadedAttachments.push(await uploadFile('/api/announcements/' + savedAnnouncement.id + '/attachments', file))
      rememberPublishedAnnouncement({ ...savedAnnouncement, attachments: uploadedAttachments })
      notifySuccess('Your announcement has been shared.'); navigate({ page: 'announcements' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) handleSessionExpired()
      else if (savedAnnouncement) { rememberPublishedAnnouncement({ ...savedAnnouncement, attachments: uploadedAttachments }); notifyError('The announcement was shared, but one or more files could not be attached. ' + errorText(error)); navigate({ page: 'announcements' }) }
      else notifyError(errorText(error))
    }
    finally { postingRef.current = false; setPosting(false) }
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const conversationId = route.conversationId
    if (!conversationId || !draft.trim() || sending) return
    setSending(true); setThreadError('')
    try {
      const message = await api<DirectMessage>('/api/messages/conversations/' + conversationId + '/messages', token, { method: 'POST', body: JSON.stringify({ message: draft.trim() }) })
      const currentDetail = conversationDetailCache.current.get(conversationId)?.detail
        ?? (detail?.conversation.id === conversationId ? detail : null)
      if (currentDetail) {
        const updatedDetail = {
          ...currentDetail,
          conversation: { ...currentDetail.conversation, latestMessage: message.message, lastMessageAt: message.createdAt, unreadCount: 0 },
          messages: [...currentDetail.messages, message],
        }
        conversationDetailCache.current.set(conversationId, { detail: updatedDetail, fetchedAt: Date.now() })
        if (detail?.conversation.id === conversationId) setDetail(updatedDetail)
      }
      setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, latestMessage: message.message, lastMessageAt: message.createdAt, unreadCount: 0 } : item))
      conversationsLoaded.current = true
      fetchedAt.current.conversations = Date.now()
      setDraft('')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError('The message could not be sent. ' + errorText(error)) }
    finally { setSending(false) }
  }
  async function startNewMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRecipient || !newMessageDraft.trim() || sendingNewMessage) return
    setSendingNewMessage(true)
    try {
      const started = await api<Conversation>('/api/messages/conversations', token, {
        method: 'POST', body: JSON.stringify({ recipientAccountId: selectedRecipient.accountId, studentProfileId: selectedRecipient.studentProfileId, message: newMessageDraft.trim() }),
      })
      setConversations((current) => [started, ...current.filter((item) => item.id !== started.id)])
      conversationsLoaded.current = true
      fetchedAt.current.conversations = Date.now()
      setSelectedRecipient(null); setRecipientQuery(''); setNewMessageDraft('')
      navigate({ page: 'messages', conversationId: started.id })
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setSendingNewMessage(false) }
  }
  const attachmentLinks = (attachments: Attachment[] | undefined, pathFor: (id: number) => string) => attachments?.length ? <div className="teacher-attachments">{attachments.map((file) => <button key={file.id} type="button" onClick={() => void downloadFile(pathFor(file.id), file.displayFilename)}><span aria-hidden="true">↳</span>{file.displayFilename}<small>{attachmentSize(file.size)}</small></button>)}</div> : null

  return <main className="teacher-workspace">
    <header className="teacher-topbar">
      <button className="teacher-brand" type="button" onClick={() => navigate({ page: 'today' })} aria-label="ClassBridge home"><img src="/images/classbridge-bridge-logo.png" alt="ClassBridge" /></button>
      <nav className="teacher-nav" aria-label="Teacher workspace">{([['today', 'Today'], ['announcements', 'Announcements'], ['messages', 'Messages'], ['classes', 'My classes'], ['profile', 'My profile']] as const).map(([page, label]) => { const active = route.page === page || (page === 'announcements' && (route.page === 'announcement-detail' || route.page === 'new-announcement')) || (page === 'messages' && (route.conversationId !== undefined || route.page === 'new-message')) || (page === 'classes' && route.page === 'class-detail'); return <button className={'teacher-nav-link' + (active ? ' is-active' : '')} key={page} onClick={() => navigate({ page })} type="button" aria-current={active ? 'page' : undefined}>{label}{page === 'messages' && unread > 0 && <span className="teacher-nav-count">{unread}</span>}</button> })}</nav>
      <div className="teacher-top-actions">
        <button className="teacher-theme-button" onClick={onToggleTheme} type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M2 12h2m16 0h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.2 8.2 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></svg>}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
        <div className="teacher-profile-menu" ref={profileRef}><button className="teacher-user-button" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-haspopup="menu">{accountAvatar(accountAppearance)}{unread > 0 && <i className="teacher-profile-unread" aria-label={`${unread} unread messages`}>{unread}</i>}<span className="teacher-user-name">{fullName}</span><span className="teacher-user-caret">⌄</span></button>{profileOpen && <div className="teacher-profile-dropdown" role="menu"><div className="teacher-profile-card">{accountAvatar(accountAppearance)}<strong>{fullName}</strong><small>{emailDraft || profile.username}</small><small>Teacher account</small></div><button role="menuitem" type="button" onClick={() => navigate({ page: 'profile' })}>My profile <span>Account settings</span></button><button role="menuitem" type="button" onClick={() => navigate({ page: 'messages' })}>Messages <span>{unread ? unread + ' unread' : 'Open inbox'}</span></button><button role="menuitem" type="button" onClick={() => navigate({ page: 'announcements' })}>School updates <span>Announcements</span></button><button className="teacher-profile-signout" role="menuitem" type="button" onClick={() => { setProfileOpen(false); setConfirmSignOut(true) }}>Sign out</button></div>}</div>
      </div>
    </header>

    <div className="teacher-page-content">
      {route.page === 'today' && <>
        <section className="teacher-welcome" aria-labelledby="welcome-title"><div className="teacher-mascot-frame teacher-mascot-pair teacher-mascot-interactive" tabIndex={0} title="Say hello to the ClassBridge beaver"><img className="teacher-pose-rest" src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><img className="teacher-pose-hover" src="/images/beaver-guide-wave.png" alt="" aria-hidden="true" /><span className="teacher-mascot-note">Here to help</span></div><div className="teacher-welcome-copy"><p className="teacher-date-line"><i /> {today.toUpperCase()} <b /> YOUR SCHOOL DAY</p><h1 id="welcome-title">Good day, {greetingName}.</h1><p>Here’s what’s happening across your school community today.</p></div><div className="teacher-welcome-action"><button className="teacher-primary-action" onClick={openNewAnnouncement} type="button"><span>＋</span> Write an announcement</button><small>Share a note with your school</small></div><SchoolSuppliesPattern className="teacher-welcome-supplies" /></section>
        <div className="teacher-dashboard-grid"><section className="teacher-noticeboard"><div className="teacher-section-heading"><div><p className="teacher-overline">THE SCHOOL NOTICEBOARD</p><h2>A few things to know</h2></div><button className="teacher-text-action" onClick={() => navigate({ page: 'announcements' })} type="button">All announcements <span>→</span></button></div>{announcementError && <div className="teacher-load-error" role="alert">Announcements could not be loaded: {announcementError}</div>}{loading ? <div className="teacher-empty-state">Checking the school noticeboard…</div> : visibleAnnouncements.length === 0 ? <div className="teacher-empty-state">{announcementError ? 'Try again after checking your connection.' : 'There are no announcements for this view yet.'}</div> : <><article className="teacher-featured-note"><div className="teacher-note-margin"><span>01</span><i /></div><div className="teacher-note-body"><div className="teacher-note-meta"><span className="teacher-note-tag">{categoryLabel(visibleAnnouncements[0].type)} · {audience(visibleAnnouncements[0])}</span><time>{stamp(visibleAnnouncements[0].createdAt)}</time></div><h3><button className="teacher-announcement-open" type="button" onClick={() => navigate({ page: 'announcement-detail', announcementId: visibleAnnouncements[0].id })}>{visibleAnnouncements[0].title}</button></h3><p>{visibleAnnouncements[0].body}</p>{attachmentLinks(visibleAnnouncements[0].attachments, (id) => '/api/announcements/' + visibleAnnouncements[0].id + '/attachments/' + id)}<div className="teacher-note-byline"><b>{initials(visibleAnnouncements[0].authorDisplayName || 'School')}</b><span>Shared by <strong>{visibleAnnouncements[0].authorDisplayName || 'your school'}</strong></span></div></div></article><div className="teacher-list-heading"><h3>From your classrooms</h3><label><span className="sr-only">Filter by class</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All classes</option>{classrooms.map((room) => <option value={String(room.id)} key={room.id}>{classroomName(room)}</option>)}</select></label></div><div className="teacher-announcement-list">{visibleAnnouncements.slice(1, 4).map((item, index) => <article className="teacher-announcement-row" key={item.id}><span className="teacher-row-index">0{index + 2}</span><time>{stamp(item.createdAt)}</time><div><span className="teacher-row-audience">{categoryLabel(item.type)} · {audience(item)}</span><h4><button className="teacher-announcement-open" type="button" onClick={() => navigate({ page: 'announcement-detail', announcementId: item.id })}>{item.title}</button></h4><p>{item.body}</p><small>Shared by <strong>{item.authorDisplayName || 'your school'}</strong></small></div><span className="teacher-row-arrow" aria-hidden="true">↗</span></article>)}</div></>}</section>
          <aside className="teacher-side-column"><section className="teacher-side-section"><div className="teacher-section-heading teacher-section-heading-small"><div><p className="teacher-overline">YOUR TEACHING SPACE</p><h2>Classes</h2></div><button className="teacher-round-action" type="button" aria-label="View all classes" onClick={() => navigate({ page: 'classes' })}>↗</button></div>{homeroomError && <div className="teacher-load-error" role="alert">{homeroomError}</div>}{homeroomClassrooms.length === 0 ? <div className="teacher-empty-state">{loading ? 'Finding your homeroom classes…' : 'No homeroom class has been assigned to you yet.'}</div> : <div className="teacher-class-list">{homeroomClassrooms.slice(0, 4).map((room, index) => <button className="teacher-class-row" key={room.id} onClick={() => navigate({ page: 'class-detail', classroomId: room.id })} type="button"><span className={'teacher-class-mark ' + (index % 2 === 0 ? 'moss' : 'river')}>{String(room.gradeLevel).padStart(2, '0')}</span><span className="teacher-class-copy"><strong>{room.gradeLevel}-{room.sectionName}</strong><span>Grade {room.gradeLevel} · Homeroom</span></span><span className="teacher-class-count">Open class →</span></button>)}</div>}</section>
            <section className="teacher-side-section teacher-conversations"><div className="teacher-section-heading teacher-section-heading-small"><div><p className="teacher-overline">A NOTE FROM HOME</p><h2>Conversations</h2></div><button className="teacher-text-action teacher-text-action-compact" onClick={() => navigate({ page: 'messages' })} type="button">Inbox <span>→</span></button></div>{conversationError && <div className="teacher-load-error" role="alert">Messages could not be loaded: {conversationError}</div>}{loading ? <div className="teacher-empty-state">Checking your inbox…</div> : conversations.length === 0 ? <div className="teacher-empty-state">{conversationError ? 'Try again after checking your connection.' : 'No conversations yet.'}</div> : <div className="teacher-conversation-list">{conversations.slice(0, 3).map((item, index) => <button className="teacher-conversation-row" key={item.id} onClick={() => navigate({ page: 'messages', conversationId: item.id })} type="button">{participantAvatar(item.otherParticipantAppearance, item.otherParticipantDisplayName || 'School', index % 2 === 0 ? 'sage' : 'sand')}<span className="teacher-conversation-copy"><strong>{item.otherParticipantDisplayName}</strong><small>{item.studentDisplayName ? 'About ' + item.studentDisplayName : item.otherParticipantRole.replaceAll('_', ' ')}</small><span>{item.latestMessage || 'Open conversation'}</span></span><time>{stamp(item.lastMessageAt)}</time></button>)}</div>}<p className="teacher-quiet-note"><i /> {unread > 0 ? unread + ' message' + (unread === 1 ? '' : 's') + ' waiting for you.' : 'You are up to date with your school community.'}</p></section><section className="teacher-week-note"><b>✳</b><div><p className="teacher-overline">YOUR SCHOOL COMMUNITY</p><strong>Updates and conversations, together.</strong><span>ClassBridge keeps your school day connected.</span></div><i aria-hidden="true">↗</i></section></aside></div>
      </>}

      {route.page === 'profile' && <section className="teacher-page-section teacher-profile-page">
        <button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'today' })}>← Back to today</button>
        <div className="teacher-profile-heading"><div>{accountAvatar(accountAppearance, 'teacher-profile-hero-avatar')}<div><p className="teacher-overline">YOUR CLASSBRIDGE ACCOUNT</p><h1>My profile</h1><p>Keep your account details and portrait up to date.</p></div></div><span className="teacher-profile-role">Teacher</span></div>
        <div className="teacher-profile-layout">
          <div className="teacher-profile-main-column">
            <section className="teacher-account-panel"><div className="teacher-profile-panel-heading"><div><p className="teacher-overline">ACCOUNT DETAILS</p><h2>Your information</h2></div><span className="teacher-readonly-mark">School managed</span></div>
              <div className="teacher-account-fields"><div><small>FULL NAME</small><strong>{fullName}</strong></div><div><small>USERNAME</small><strong>{profile.username}</strong></div><div><small>ROLE</small><strong>Teacher</strong></div></div>
              <p className="teacher-profile-note">Your name, username, and role are managed by your school and can’t be changed here.</p>
            </section>

            <section className="teacher-account-panel teacher-contact-panel"><div className="teacher-profile-panel-heading"><div><p className="teacher-overline">CONTACT DETAILS</p><h2>Ways to reach you</h2></div></div>
              <form className="teacher-profile-field-form" onSubmit={(event) => { event.preventDefault(); void saveEmail() }}><label htmlFor="teacher-profile-email">Email address <span className={'teacher-email-status' + (emailVerified ? ' is-verified' : '')}>{emailVerified ? 'Verified' : 'Not verified'}</span></label><div className="teacher-profile-inline-field"><input id="teacher-profile-email" type="email" autoComplete="email" maxLength={254} value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="you@example.com" /><button className={'teacher-primary-action teacher-contact-action' + (profileSaving ? ' is-busy' : '')} type="submit" disabled={profileSaving || !emailDraft.trim()}>{profileSaving ? 'Saving…' : 'Save email'}</button></div></form>
              {emailDraft && !emailVerified && <div className="teacher-verification-tools"><button className={'teacher-text-action' + (profileSaving ? ' is-busy' : '')} disabled={profileSaving} onClick={() => void sendVerificationCode()} type="button">{verificationSent ? 'Send a new code' : 'Send verification code'} <span>→</span></button>{verificationSent && <form className="teacher-profile-inline-field teacher-code-form" onSubmit={confirmVerification}><label className="sr-only" htmlFor="teacher-email-code">Six-digit verification code</label><input id="teacher-email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" /><button className={'teacher-secondary-action' + (profileSaving ? ' is-busy' : '')} type="submit" disabled={profileSaving || verificationCode.length !== 6}>{profileSaving ? 'Checking…' : 'Verify email'}</button></form>}</div>}
              <form className="teacher-profile-field-form" onSubmit={(event) => { event.preventDefault(); void savePhone() }}><label htmlFor="teacher-profile-phone">Phone number</label><div className="teacher-profile-inline-field"><input id="teacher-profile-phone" type="tel" autoComplete="tel" maxLength={32} value={phoneDraft} onChange={(event) => setPhoneDraft(event.target.value)} placeholder="Add your phone number" /><button className={'teacher-primary-action teacher-contact-action' + (profileSaving ? ' is-busy' : '')} type="submit" disabled={profileSaving || !phoneDraft.trim() || phoneDraft.trim() === savedPhone}>{profileSaving ? 'Saving…' : 'Save number'}</button></div></form>
            </section>

            <section className="teacher-account-panel teacher-security-panel"><div className="teacher-profile-panel-heading"><div><p className="teacher-overline">SECURITY</p><h2>Change your password</h2></div></div>
              <form className="teacher-password-form" onSubmit={changePassword}>
                <div className="teacher-password-grid">
                  <label className="teacher-password-field" htmlFor="teacher-current-password">Current password<input id="teacher-current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                  <label className="teacher-password-field" htmlFor="teacher-new-password">New password<input id="teacher-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                  <label className="teacher-password-field" htmlFor="teacher-confirm-password">Confirm new password<input id="teacher-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label>
                </div>
                <div className="teacher-password-actions"><small>Use 8 to 20 characters. Your current password is required.</small><button className={'teacher-primary-action' + (passwordSaving ? ' is-busy' : '')} type="submit" disabled={passwordSaving || !currentPassword || !newPassword || !passwordConfirmation}>{passwordSaving ? 'Updating…' : 'Update password'}</button></div>
              </form>
            </section>
          </div>

          <aside className="teacher-profile-side-column">
            <section className="teacher-account-panel teacher-avatar-panel"><div className="teacher-profile-panel-heading"><div><p className="teacher-overline">YOUR PORTRAIT</p><h2>Choose an avatar</h2></div></div><div className="teacher-avatar-preview">{accountAvatar(appearanceDraft, 'teacher-avatar-preview-image')}<span><strong>{appearanceDraft.avatarType === 'PHOTO' ? 'Your photo' : appearanceDraft.avatarType === 'ANIMAL' ? (() => { const animal = selectedProfileAnimal(appearanceDraft); return animal ? `${animal.name} · ${animal.group === 'adult' ? 'Adult' : 'Student'}` : 'Animal portrait' })() : 'Your initials'}</strong><small>Choose any portrait, for adults or students.</small></span></div>
              <div className="teacher-avatar-initial-choice"><button className={'teacher-avatar-choice' + (appearanceDraft.avatarType === 'INITIALS' ? ' is-selected' : '')} onClick={() => setAppearanceDraft({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })} type="button"><span className="teacher-avatar-option-initials">{initials(fullName)}</span><strong>Initials</strong></button></div>
              <div className="teacher-avatar-groups" aria-label="Animal portraits">
                {(['adult', 'student'] as const).map((group) => <section className="teacher-avatar-group" key={group} aria-labelledby={'teacher-avatar-group-' + group}><h3 id={'teacher-avatar-group-' + group}>{group === 'adult' ? 'For adults' : 'For students'}</h3><div className="teacher-avatar-options" role="group" aria-label={group === 'adult' ? 'Adult animal portraits' : 'Student animal portraits'}>{profileAnimalOptions.filter((animal) => animal.group === group).map((animal) => <button className={'teacher-avatar-choice' + (appearanceDraft.avatarType === 'ANIMAL' && appearanceDraft.animal === animal.id ? ' is-selected' : '')} key={animal.id} aria-label={`${animal.name} · ${group === 'adult' ? 'Adult' : 'Student'}`} aria-pressed={appearanceDraft.avatarType === 'ANIMAL' && appearanceDraft.animal === animal.id} title={`${animal.name} · ${group === 'adult' ? 'Adult' : 'Student'}`} onClick={() => setAppearanceDraft({ avatarType: 'ANIMAL', animal: animal.id, imageDataUrl: null })} type="button"><span className="teacher-avatar-option-animal" style={profileAnimalArt(animal)} /><strong>{animal.name}</strong></button>)}</div></section>)}
              </div>
              <label className="teacher-avatar-upload">＋ Upload a photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatarFile} /></label><small className="teacher-avatar-hint">JPG, PNG or WebP · up to 2 MB</small><button className={'teacher-primary-action teacher-avatar-save' + (appearanceSaving ? ' is-busy' : '')} onClick={() => void saveAppearance()} disabled={appearanceSaving} type="button">{appearanceSaving ? 'Saving…' : 'Save avatar'}</button>
            </section>
            <section className="teacher-account-panel teacher-profile-shortcuts"><p className="teacher-overline">QUICK ACCESS</p><button type="button" onClick={() => navigate({ page: 'messages' })}><span>Messages</span><small>{unread ? unread + ' unread' : 'Open your inbox'}</small><b>↗</b></button><button type="button" onClick={() => navigate({ page: 'announcements' })}><span>School updates</span><small>Read recent announcements</small><b>↗</b></button><button className="teacher-profile-signout-link" type="button" onClick={() => setConfirmSignOut(true)}><span>Sign out</span><small>We’ll ask before ending your session</small><b>→</b></button></section>
          </aside>
        </div>
      </section>}

      {route.page === 'announcements' && <section className="teacher-page-section">
        <div className="teacher-page-title teacher-announcement-page-title"><div><p className="teacher-overline">YOUR ANNOUNCEMENT HISTORY</p><h1>Announcements</h1><p>Review announcements you’ve shared and browse them by type.</p></div><div className="teacher-notice-mascot teacher-mascot-pair teacher-mascot-interactive" tabIndex={0} role="img" aria-label="Beaver holding a megaphone; hover to announce" title="Hover to hear the latest news"><img className="teacher-pose-rest" src="/images/beaver-announcement-rest.png" alt="" /><img className="teacher-pose-hover" src="/images/beaver-announcement-cutout.png" alt="" /><span>Fresh from the noticeboard</span></div><button className="teacher-primary-action" onClick={openNewAnnouncement} type="button"><span>＋</span> Write an announcement</button></div>
        {announcementHistoryError && <div className="teacher-load-error" role="alert">{announcementHistoryError}</div>}
        <div className="teacher-announcement-tools"><label className="teacher-search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></svg><span className="sr-only">Search announcements</span><input value={announcementQuery} onChange={(event) => setAnnouncementQuery(event.target.value)} placeholder="Search announcements" /></label><label className="teacher-type-filter"><span>Announcement type</span><select value={announcementTypeFilter} onChange={(event) => setAnnouncementTypeFilter(event.target.value as 'all' | AnnouncementType)}><option value="all">All types</option>{announcementCategories.map((item) => <option value={item.value} key={item.value}>{item.title}</option>)}</select></label><span className="teacher-result-count">{visibleAnnouncements.length} {visibleAnnouncements.length === 1 ? 'notice' : 'notices'}</span></div>
        {loading ? <div className="teacher-empty-state">Loading announcements…</div> : authoredAnnouncements.length === 0 ? <div className="teacher-empty-state">{announcementHistoryError ? 'Your announcements could not be loaded.' : 'You haven’t shared any announcements yet.'}</div> : visibleAnnouncements.length === 0 ? <div className="teacher-empty-state">No notices match those filters. Try another search or type.</div> : <div className="teacher-full-announcement-list">{visibleAnnouncements.map((item, index) => <article className="teacher-announcement-row" key={item.id}><span className="teacher-row-index">{String(index + 1).padStart(2, '0')}</span><time>{stamp(item.createdAt)}</time><div><span className="teacher-row-audience">{categoryLabel(item.type)} · {audience(item)}</span><h4><button className="teacher-announcement-open" onClick={() => navigate({ page: 'announcement-detail', announcementId: item.id })} type="button">{item.title}</button></h4><p>{item.body}</p><small>Shared by {item.authorDisplayName || 'your school'}</small>{attachmentLinks(item.attachments, (id) => '/api/announcements/' + item.id + '/attachments/' + id)}</div><button className="teacher-row-arrow teacher-announcement-detail-arrow" aria-label={'Open announcement: ' + item.title} onClick={() => navigate({ page: 'announcement-detail', announcementId: item.id })} type="button">↗</button></article>)}</div>}
      </section>}

      {route.page === 'announcement-detail' && <section className="teacher-page-section teacher-announcement-detail-page"><button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'announcements' })}>← Back to announcements</button>{!selectedAnnouncement ? announcementDetailLoading ? <div className="teacher-empty-state">Opening announcement…</div> : <div className="teacher-empty-state">{announcementDetailError || 'This announcement is no longer available in your school noticeboard.'}</div> : <article className="teacher-announcement-detail-card"><div className="teacher-detail-margin"><span>{categoryLabel(selectedAnnouncement.type)}</span><i /></div><div className="teacher-detail-copy"><p className="teacher-overline">{audience(selectedAnnouncement).toUpperCase()}</p><h1>{selectedAnnouncement.title}</h1><div className="teacher-detail-byline"><span className="teacher-user-avatar">{initials(selectedAnnouncement.authorDisplayName || 'School')}</span><span><strong>{selectedAnnouncement.authorDisplayName || 'Your school'}</strong><small>{stamp(selectedAnnouncement.createdAt)}</small></span></div><div className="teacher-detail-body">{selectedAnnouncement.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{attachmentLinks(selectedAnnouncement.attachments, (id) => '/api/announcements/' + selectedAnnouncement.id + '/attachments/' + id)}</div></article>}</section>}

      {route.page === 'new-announcement' && <section className="teacher-page-section teacher-compose-page"><button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'announcements' })}>← Back to announcements</button><div className="teacher-compose-layout"><div><p className="teacher-overline">SHARE WITH YOUR SCHOOL</p><h1>Write an announcement</h1><p className="teacher-page-intro">Choose who should see this update, add the details, and attach a file if it helps.</p><div className="teacher-compose-aside teacher-compose-aside-megaphone"><img src="/images/beaver-announcement-cutout.png" alt="ClassBridge beaver with a megaphone" /><span><strong>A clear note goes a long way.</strong><small>Your announcement will appear on the school noticeboard.</small></span></div></div><form className="teacher-compose-form" onSubmit={publishAnnouncement}>
        <fieldset className="teacher-category-picker"><legend>Announcement type</legend><div className="teacher-category-options">{announcementCategories.map((item) => <label className={'teacher-category-option' + (category === item.value ? ' is-selected' : '')} key={item.value}><input type="radio" name="announcement-type" value={item.value} checked={category === item.value} onChange={() => setCategory(item.value)} /><span className={'teacher-category-illustration ' + item.mark}>{categoryIllustration(item.mark)}</span><span className="teacher-category-copy"><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</div></fieldset>
        <fieldset className="teacher-classroom-picker"><legend>Send to classrooms</legend><p>Select one or more classes in your school.</p>{classroomError && <div className="teacher-load-error" role="alert">{classroomError}</div>}{classrooms.length > 0 && <label className="teacher-select-all"><input type="checkbox" checked={selectedClassrooms.length === classrooms.length && classrooms.length > 0} onChange={(event) => selectAllClassrooms(event.target.checked)} /> Select all classrooms</label>}{classrooms.length === 0 ? <div className="teacher-empty-state">{loading ? 'Loading classrooms…' : 'No classrooms are available yet. Your school administrator can add them first.'}</div> : <div className="teacher-classroom-options">{classrooms.map((room) => <label key={room.id}><input type="checkbox" checked={selectedClassrooms.includes(String(room.id))} onChange={() => toggleClassroom(room.id)} /><span><strong>{room.gradeLevel}-{room.sectionName}</strong><small>{classroomName(room)}</small></span></label>)}</div>}</fieldset>
        <label>Title<input maxLength={255} onChange={(event) => setTitle(event.target.value)} placeholder="What is this announcement about?" required value={title} /></label><label>Message<textarea onChange={(event) => setBody(event.target.value)} placeholder="Write the details for families and students…" required rows={7} value={body} /></label>
        <div className="teacher-file-picker-group"><strong>Attachments</strong><small>PDF, JPG or PNG · up to 10 MB each · up to 5 files</small><label className="teacher-file-picker"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5h14v-5" /></svg><span><strong>Choose files</strong><small>{announcementFiles.length ? announcementFiles.length + ' of 5 files selected' : 'Add a document or image'}</small></span><input type="file" aria-label="Choose announcement attachments" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={handleAnnouncementFiles} /></label></div>
        {announcementFiles.length > 0 && <div className="teacher-selected-files">{announcementFiles.map((file, index) => <span key={file.name + index}><b aria-hidden="true">↗</b><span className="teacher-selected-file-name">{file.name} <small>{attachmentSize(file.size)}</small></span><button type="button" aria-label={'Remove ' + file.name} onClick={() => setAnnouncementFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</div>}<div className="teacher-compose-footer"><button className="teacher-text-action" onClick={() => navigate({ page: 'announcements' })} type="button">Cancel</button><button className="teacher-primary-action" disabled={posting || classrooms.length === 0 || selectedClassrooms.length === 0} type="submit">{posting ? 'Sharing…' : 'Share announcement'}</button></div></form></div></section>}

      {route.page === 'new-message' && <section className="teacher-page-section teacher-new-message-page">
        <button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'messages' })}>← Back to inbox</button>
        <div className="teacher-compose-layout">
          <div>
            <p className="teacher-overline">SCHOOL COMMUNITY</p>
            <h1 className="teacher-page-title-text">New message</h1>
            <p className="teacher-page-intro">Choose one person in your school and send a private note.</p>
            <div className="teacher-compose-aside teacher-compose-aside-megaphone"><img src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><span><strong>One-to-one, school-safe messaging.</strong><small>Search students, parents and school staff by name, username or school number.</small></span></div>
          </div>
          <form className="teacher-new-message-form" onSubmit={startNewMessage}>
            <div className="teacher-recipient-heading"><div><p className="teacher-overline">RECIPIENT</p><h2>Choose one person</h2></div></div>
            <label className="teacher-search-field teacher-student-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></svg>
              <span className="sr-only">Search your school</span>
              <input value={recipientQuery} onChange={(event) => { setRecipientQuery(event.target.value); setRecipients([]); setSelectedRecipient(null); setRecipientError('') }} placeholder="Search by name, username or school number" />
            </label>
            {recipientError && <div className="teacher-load-error" role="alert">{recipientError}</div>}
            {recipientLoading && <p className="teacher-recipient-hint">Searching your school…</p>}
            {!selectedRecipient && recipientQuery.trim().length < 2 && <div className="teacher-recipient-section"><p className="teacher-recipient-section-title">RECENT CONVERSATIONS</p>{recentRecipients.length ? <div className="teacher-recipient-results">{recentRecipients.map((recipient, index) => <button className="teacher-recipient-option" key={recipient.accountId + '-' + (recipient.studentProfileId ?? 'school') + '-' + index} onClick={() => { setSelectedRecipient(recipient); setRecipientError('') }} type="button"><span className={'teacher-conversation-avatar ' + (index % 2 === 0 ? 'sage' : 'sand')}>{initials(recipient.displayName)}</span><span><strong>{recipient.displayName}</strong><small>{recipient.role.replaceAll('_', ' ')}{recipient.studentProfileId ? ' · ' + conversations.find((item) => item.otherParticipantAccountId === recipient.accountId && item.studentProfileId === recipient.studentProfileId)?.studentDisplayName : ''}</small></span><i aria-hidden="true">＋</i></button>)}</div> : <p className="teacher-recipient-hint">Your recent conversations will appear here.</p>}</div>}
            {!selectedRecipient && recipientQuery.trim().length === 1 && <p className="teacher-recipient-hint">Enter at least two characters to search.</p>}
            {!selectedRecipient && recipientQuery.trim().length >= 2 && !recipientLoading && <div className="teacher-recipient-section">{recipients.length ? <div className="teacher-recipient-results">{recipients.map((recipient) => <button className="teacher-recipient-option" key={recipient.accountId + '-' + (recipient.studentProfileId ?? 'school')} onClick={() => { setSelectedRecipient(recipient); setRecipientError('') }} type="button"><span className="teacher-conversation-avatar sage">{initials(recipient.displayName)}</span><span><strong>{recipient.displayName}</strong><small>{recipient.role.replaceAll('_', ' ')}{recipient.schoolNumber ? ' · No. ' + recipient.schoolNumber : ''}</small></span><i aria-hidden="true">＋</i></button>)}</div> : !recipientError && <p className="teacher-recipient-hint">No matching people were found in your school.</p>}</div>}
            {selectedRecipient && <>
              <div className="teacher-recipient-selected"><span className="teacher-conversation-avatar sage">{initials(selectedRecipient.displayName)}</span><span><strong>{selectedRecipient.displayName}</strong><small>{selectedRecipient.role.replaceAll('_', ' ')}{selectedRecipient.schoolNumber ? ' · No. ' + selectedRecipient.schoolNumber : ''}</small></span><button onClick={() => { setSelectedRecipient(null); setNewMessageDraft('') }} type="button">Change</button></div>
              <label className="teacher-new-message-body">Message<textarea maxLength={5000} onChange={(event) => setNewMessageDraft(event.target.value)} placeholder={'Write a private message to ' + selectedRecipient.displayName + '…'} required rows={5} value={newMessageDraft} /><small>{newMessageDraft.length}/5000</small></label>
            </>}
            <div className="teacher-compose-footer"><button className="teacher-text-action" onClick={() => navigate({ page: 'messages' })} type="button">Cancel</button><button className="teacher-primary-action" disabled={sendingNewMessage || !selectedRecipient || !newMessageDraft.trim()} type="submit">{sendingNewMessage ? 'Sending…' : 'Send message'}</button></div>
          </form>
        </div>
      </section>}
      {route.page === 'messages' && (
        route.conversationId ? (
          <section className="teacher-page-section">
            <button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'messages' })}>← Back to inbox</button>
            <div className="teacher-thread-layout">
              <aside className="teacher-thread-sidebar"><p>YOUR CONVERSATIONS</p>{conversations.length ? <nav className="teacher-thread-sidebar-list" aria-label="Your conversations">{conversations.map((item, index) => <button className={'teacher-thread-sidebar-item' + (item.id === route.conversationId ? ' is-active' : '')} key={item.id} onClick={() => navigate({ page: 'messages', conversationId: item.id })} type="button" aria-current={item.id === route.conversationId ? 'page' : undefined}>{participantAvatar(item.otherParticipantAppearance, item.otherParticipantDisplayName, index % 2 === 0 ? 'sage' : 'sand')}<span><strong>{item.otherParticipantDisplayName}</strong><small>{item.studentDisplayName ? 'About ' + item.studentDisplayName + ' · ' : ''}{item.latestMessage || item.otherParticipantRole.replaceAll('_', ' ')}</small></span></button>)}</nav> : <div className="teacher-thread-sidebar-empty">{loading ? 'Loading your conversations…' : 'Your previous conversations will appear here.'}</div>}</aside>
              <div className="teacher-thread-page">
              <header className="teacher-thread-header">
                <div>
                  <p className="teacher-overline">SCHOOL CONVERSATION</p>
                  <h1>{selectedConversation?.otherParticipantDisplayName || 'Conversation'}</h1>
                  <span>{selectedConversation?.studentDisplayName ? 'About ' + selectedConversation.studentDisplayName : selectedConversation?.otherParticipantRole.replaceAll('_', ' ')}</span>
                </div>
              </header>
              {threadError && <div className="teacher-load-error" role="alert">{threadError}</div>}
              {threadLoading ? <div className="teacher-empty-state">Opening conversation…</div> : detail ? (
                <>
                  <div className="teacher-thread-messages teacher-thread-page-messages">
                    {detail.messages.map((message) => (
                      <article className={'teacher-message-bubble' + (message.senderAccountId === profile.userAccountId ? ' is-own' : '')} key={message.id}>
                        {participantAvatar(message.senderAccountId === profile.userAccountId ? accountAppearance : selectedConversation?.otherParticipantAppearance, message.senderDisplayName, 'teacher-message-sender-avatar')}
                        <span>{message.message}</span>
                        {attachmentLinks(message.attachments, (id) => '/api/messages/conversations/' + route.conversationId + '/messages/' + message.id + '/attachments/' + id)}
                        <small>{message.senderDisplayName} · {stamp(message.createdAt)}</small>
                      </article>
                    ))}
                  </div>
                  {detail.conversation.readOnly ? <p className="teacher-empty-state">This conversation is read-only.</p> : (
                    <form className="teacher-message-compose" onSubmit={sendMessage}>
                      <label className="sr-only" htmlFor="teacher-message-draft">Your message</label>
                      <textarea id="teacher-message-draft" maxLength={5000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply…" rows={3} value={draft} />
                      <button className="teacher-primary-action" disabled={sending || !draft.trim()} type="submit">{sending ? 'Sending…' : 'Send message'}</button>
                    </form>
                  )}
                </>
              ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section className="teacher-page-section">
            <div className="teacher-page-title teacher-message-page-title">
              <div><p className="teacher-overline">SCHOOL CONVERSATIONS</p><h1>Messages</h1><p>Your conversations with families and colleagues.</p></div>
              <div className="teacher-message-mascot teacher-mascot-pair teacher-mascot-interactive" tabIndex={0} role="img" aria-label="Beaver holding letters; hover to lift the mail" title="Hover to see today's mail">
                <img className="teacher-pose-rest" src="/images/beaver-message-rest.png" alt="" />
                <img className="teacher-pose-hover" src="/images/beaver-message-raised.png" alt="" />
                <span>Mail for you</span>
              </div>
              <div className="teacher-message-list-actions">
                <span className="teacher-inbox-count">{unread} unread</span>
                <button className="teacher-primary-action" onClick={() => { setRecipientQuery(''); setRecipients([]); setSelectedRecipient(null); setNewMessageDraft(''); navigate({ page: 'new-message' }) }} type="button"><span>＋</span> New message</button>
              </div>
            </div>
            {conversationError && <div className="teacher-load-error" role="alert">{conversationError}</div>}
            {loading ? <div className="teacher-empty-state">Loading conversations…</div> : conversations.length === 0 ? <div className="teacher-empty-state">No conversations to show yet. Start a new message to a student in your school.</div> : (
              <div className="teacher-inbox-list">
                {conversations.map((item, index) => (
                  <button className="teacher-inbox-row" key={item.id} onClick={() => navigate({ page: 'messages', conversationId: item.id })} type="button">
                  {participantAvatar(item.otherParticipantAppearance, item.otherParticipantDisplayName || 'School', index % 2 === 0 ? 'sage' : 'sand')}
                    <span><strong>{item.otherParticipantDisplayName}</strong><small>{item.studentDisplayName ? 'About ' + item.studentDisplayName : item.otherParticipantRole.replaceAll('_', ' ')}</small><span>{item.latestMessage || 'Open conversation'}</span></span>
                    <time>{stamp(item.lastMessageAt)}</time>
                    {item.unreadCount > 0 && <i>{item.unreadCount}</i>}
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      )}      {route.page === 'classes' && <section className="teacher-page-section"><div className="teacher-page-title"><div><p className="teacher-overline">YOUR TEACHING SPACE</p><h1>My classes</h1><p>Only the homeroom classes assigned to you appear here.</p></div></div>{homeroomError && <div className="teacher-load-error" role="alert">{homeroomError}</div>}{loading ? <div className="teacher-empty-state">Loading your homeroom classes…</div> : homeroomClassrooms.length === 0 ? <div className="teacher-empty-state">No homeroom class has been assigned to you yet. Your school administrator can assign one.</div> : <div className="teacher-classroom-grid">{homeroomClassrooms.map((room, index) => <button className="teacher-classroom-card teacher-classroom-card-button" key={room.id} onClick={() => navigate({ page: 'class-detail', classroomId: room.id })} type="button"><span className={'teacher-class-mark ' + (index % 2 === 0 ? 'moss' : 'river')}>{String(room.gradeLevel).padStart(2, '0')}</span><span className="teacher-classroom-card-copy"><p className="teacher-overline">YOUR HOMEROOM</p><strong>{room.gradeLevel}-{room.sectionName}</strong><small>Open class and view students →</small></span><span className="teacher-classroom-card-arrow" aria-hidden="true">↗</span></button>)}</div>}</section>}

      {route.page === 'class-detail' && <section className="teacher-page-section"><button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'classes' })}>← Back to my classes</button>{classDetailError && <div className="teacher-load-error" role="alert">{classDetailError}</div>}{classDetailLoading ? <div className="teacher-empty-state">Opening class…</div> : classroomDetail && <><div className="teacher-page-title"><div><p className="teacher-overline">YOUR HOMEROOM CLASS</p><h1>{classroomDetail.gradeLevel}-{classroomDetail.sectionName}</h1><p>{classroomDetail.students.length} active student profiles</p></div><span className="teacher-class-mark moss">{String(classroomDetail.gradeLevel).padStart(2, '0')}</span></div>{classroomDetail.students.length === 0 ? <div className="teacher-empty-state">There are no active student profiles in this classroom yet.</div> : <div className="teacher-student-profile-grid">{classroomDetail.students.map((student) => <article className="teacher-student-profile-card" key={student.id}><span className="teacher-student-initials">{initials(student.firstName + ' ' + student.lastName)}</span><div><strong>{student.firstName} {student.lastName}</strong><small>School number {student.schoolNumber}</small></div><span className="teacher-student-class">{student.gradeLevel}-{student.sectionName}</span></article>)}</div>}</>}</section>}
    </div>
    <footer className="teacher-footer"><span>ClassBridge</span><i /> A more connected school community</footer>

    {transitionLabel && <WorkspaceTransition tone="teacher" />}

    {confirmSignOut && <div className="teacher-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSignOut(false) }} role="presentation"><section className="teacher-signout-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title"><button className="teacher-signout-close" onClick={() => setConfirmSignOut(false)} type="button" aria-label="Close">×</button><img src="/images/beaver-signout-cutout.png" alt="ClassBridge beaver looks unsure about leaving" /><p className="teacher-overline">BEFORE YOU HEAD OUT</p><h2 id="signout-title">Ready to leave, {greetingName}?</h2><p>You can come back to your school space whenever you’re ready.</p><div><button className="teacher-text-action" onClick={() => setConfirmSignOut(false)} type="button">Stay here</button><button className="teacher-primary-action" onClick={onSignOut} type="button">Sign out</button></div></section></div>}

    {sessionExpired && <div className="teacher-modal-backdrop teacher-session-expired-backdrop" role="presentation"><section className="teacher-signout-modal teacher-session-expired-modal" role="dialog" aria-modal="true" aria-labelledby="session-expired-title"><img src="/images/beaver-session-expired.png" alt="The ClassBridge beaver holds an hourglass" /><p className="teacher-overline">A QUICK PAUSE</p><h2 id="session-expired-title">Your session has expired</h2><p>Please sign in again to continue to your school workspace.</p><div><button className="teacher-primary-action" onClick={onSessionExpired} type="button">Back to sign in</button></div></section></div>}

    {successToast && <aside className="teacher-success-toast" role="status" aria-live="polite"><img src="/images/beaver-success-cutout.png" alt="" /><div><strong>All set!</strong><p>{successToast}</p></div><button type="button" onClick={dismissSuccessToast} aria-label="Dismiss success message">×</button></aside>}
    {errorToast && <aside className="teacher-error-toast" role="alert"><img src="/images/beaver-error-cutout.png" alt="" /><div><strong>Something went wrong</strong><p>{errorToast}</p></div><button type="button" onClick={dismissErrorToast} aria-label="Dismiss error message">×</button></aside>}
  </main>
}
