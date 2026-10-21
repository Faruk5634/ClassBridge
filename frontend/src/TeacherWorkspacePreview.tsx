import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { ThemeMode } from './LoginExperience'
import './TeacherWorkspacePreview.css'

type Profile = { userAccountId: number; username: string; firstName: string; lastName: string; email?: string | null; emailVerified?: boolean; role?: string; phoneNumber?: string | null }
type TargetClassroom = { id?: number; classroomId?: number; gradeLevel: number; sectionName: string }
type AnnouncementType = 'GENERAL' | 'EXAM' | 'EVENT' | 'EXAM_RESULTS'
type Attachment = { id: number; displayFilename: string; contentType: string; size: number; createdAt?: string }
type Announcement = { id: number; title: string; body: string; type: AnnouncementType; authorDisplayName: string; targetClassrooms: TargetClassroom[]; attachments: Attachment[]; createdAt: string }
type Conversation = { id: number; studentProfileId: number | null; studentDisplayName: string | null; otherParticipantDisplayName: string; otherParticipantRole: string; readOnly: boolean; unreadCount: number; latestMessage: string | null; lastMessageAt: string }
type DirectMessage = { id: number; senderAccountId: number; senderDisplayName: string; message: string; createdAt: string; attachments: Attachment[] }
type ConversationDetail = { conversation: Conversation; messages: DirectMessage[] }
type Classroom = { id: number; gradeLevel: number; sectionName: string }
type Student = { id: number; schoolNumber: string; firstName: string; lastName: string; classroomId: number; gradeLevel: number; sectionName: string }
type ClassroomDetail = Classroom & { students: Student[] }
type Route = { page: 'today' | 'profile' | 'announcements' | 'announcement-detail' | 'new-announcement' | 'messages' | 'new-message' | 'classes' | 'class-detail'; conversationId?: number; announcementId?: number; classroomId?: number }
type AvatarType = 'INITIALS' | 'ANIMAL' | 'PHOTO'
type AccountAppearance = { avatarType: AvatarType; animal: string | null; imageDataUrl: string | null }
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
  { value: 'EXAM', title: 'Exam announcement', description: 'Upcoming exam information', mark: 'pencil' },
  { value: 'EVENT', title: 'School event', description: 'Meeting, trip or activity', mark: 'bell' },
  { value: 'EXAM_RESULTS', title: 'Exam results', description: 'Results and next steps', mark: 'star' },
]

type ProfileAnimal = { id: string; name: string; group: 'adult' | 'student'; column: number; row: number }
const profileAnimalSpecies = ['Lion', 'Bear', 'Koala', 'Turtle', 'Owl', 'Hippo', 'Snake', 'Fox', 'Rabbit', 'Otter', 'Cheetah']
const profileAnimalOptions: ProfileAnimal[] = profileAnimalSpecies.flatMap((name, index) => (['adult', 'student'] as const).map((group) => ({
  id: name.toUpperCase() + '_' + group.toUpperCase(), name, group, column: index % 4, row: Math.floor(index / 4),
})))
function profileAnimalArt(animal: ProfileAnimal) {
  const rowPosition = ['-5.56%', '38.89%', '83.33%'][animal.row]
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
  const response = await fetch(path, { ...init, headers })
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
function categoryLabel(type?: AnnouncementType) { return ({ GENERAL: 'General notice', EXAM: 'Exam announcement', EVENT: 'School event', EXAM_RESULTS: 'Exam results' } as const)[type || 'GENERAL'] }
function audience(item: Announcement) { return item.targetClassrooms?.length ? item.targetClassrooms.map((room) => 'Grade ' + room.gradeLevel + ' · ' + room.sectionName).join(', ') : 'School notice' }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.' }
function attachmentSize(size: number) { return size < 1024 * 1024 ? Math.max(1, Math.round(size / 1024)) + ' KB' : (size / (1024 * 1024)).toFixed(1) + ' MB' }
function categoryIllustration(mark: string) {
  if (mark === 'pencil') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m7 22 13-13 5 5-13 13-6 1 1-6Z" /><path d="m18 11 5 5M7 22l5 5M6 29h20" /></svg>
  if (mark === 'bell') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 22h16l-2-3v-6a6 6 0 0 0-12 0v6l-2 3Z" /><path d="M13 25a3 3 0 0 0 6 0M16 6V4" /></svg>
  if (mark === 'star') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 4 3.6 7.4 8.2 1.2-5.9 5.8 1.4 8.2-7.3-3.9-7.3 3.9 1.4-8.2-5.9-5.8 8.2-1.2L16 4Z" /></svg>
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27s-11-6.3-11-14a6 6 0 0 1 11-3.4A6 6 0 0 1 27 13c0 7.7-11 14-11 14Z" /><path d="M8 18h5l2-4 3 7 2-4h4" /></svg>
}
function playWoodKnocks() {
  const AudioContextCtor = window.AudioContext
  if (!AudioContextCtor) return
  try {
    const context = new AudioContextCtor()
    const now = context.currentTime
    ;[0, 0.17].forEach((delay, index) => {
      const length = Math.floor(context.sampleRate * 0.1)
      const buffer = context.createBuffer(1, length, context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4
      const source = context.createBufferSource(); source.buffer = buffer
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = index === 0 ? 520 : 390
      const gain = context.createGain(); gain.gain.setValueAtTime(0.17, now + delay); gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09)
      source.connect(filter); filter.connect(gain); gain.connect(context.destination)
      source.start(now + delay); source.stop(now + delay + 0.1)
    })
    window.setTimeout(() => void context.close(), 450)
  } catch { /* Audio is an optional, user-controlled transition detail. */ }
}

export default function TeacherWorkspacePreview({ theme, token, profile, onToggleTheme, onSignOut, onSessionExpired }: Props) {
  const [route, setRoute] = useState<Route>(readRoute)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [homeroomClassrooms, setHomeroomClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classroomDetail, setClassroomDetail] = useState<ClassroomDetail | null>(null)
  const [classDetailLoading, setClassDetailLoading] = useState(false)
  const [classDetailError, setClassDetailError] = useState('')
  const [announcementError, setAnnouncementError] = useState('')
  const [conversationError, setConversationError] = useState('')
  const [classroomError, setClassroomError] = useState('')
  const [homeroomError, setHomeroomError] = useState('')
  const [studentError, setStudentError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState('all')
  const [announcementQuery, setAnnouncementQuery] = useState('')
  const [announcementTypeFilter, setAnnouncementTypeFilter] = useState<'all' | AnnouncementType>('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<AnnouncementType>('GENERAL')
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([])
  const [announcementFiles, setAnnouncementFiles] = useState<File[]>([])
  const [posting, setPosting] = useState(false)
  const [postStatus, setPostStatus] = useState('')
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState('')
  const [draft, setDraft] = useState('')
  const [messageFiles, setMessageFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [studentQuery, setStudentQuery] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [newMessageDraft, setNewMessageDraft] = useState('')
  const [newMessageFiles, setNewMessageFiles] = useState<File[]>([])
  const [sendingNewMessage, setSendingNewMessage] = useState(false)
  const [newMessageStatus, setNewMessageStatus] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [accountAppearance, setAccountAppearance] = useState<AccountAppearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceDraft, setAppearanceDraft] = useState<AccountAppearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceSaving, setAppearanceSaving] = useState(false)
  const [profileStatus, setProfileStatus] = useState('')
  const [emailDraft, setEmailDraft] = useState(profile.email || '')
  const [savedEmail, setSavedEmail] = useState(profile.email || '')
  const [emailVerified, setEmailVerified] = useState(Boolean(profile.emailVerified))
  const [phoneDraft, setPhoneDraft] = useState(profile.phoneNumber || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [transitionLabel, setTransitionLabel] = useState('')
  const [transitionIsDetail, setTransitionIsDetail] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [errorToast, setErrorToast] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem('classbridge.teacher.sound') === 'on')
  const navigationTimer = useRef<number | null>(null)
  const errorToastTimer = useRef<number | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  function handleSessionExpired() { setSessionExpired(true) }
  function notifyError(message: string) {
    setErrorToast(message)
    if (errorToastTimer.current) window.clearTimeout(errorToastTimer.current)
    errorToastTimer.current = window.setTimeout(() => { setErrorToast(''); errorToastTimer.current = null }, 7000)
  }
  function dismissErrorToast() {
    if (errorToastTimer.current) window.clearTimeout(errorToastTimer.current)
    errorToastTimer.current = null
    setErrorToast('')
  }

  useEffect(() => {
    const sync = () => { if (navigationTimer.current) window.clearTimeout(navigationTimer.current); setTransitionLabel(''); setRoute(readRoute()) }
    window.addEventListener('popstate', sync); window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])
  useEffect(() => { window.localStorage.setItem('classbridge.teacher.sound', soundEnabled ? 'on' : 'off') }, [soundEnabled])
  useEffect(() => () => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
    if (errorToastTimer.current) window.clearTimeout(errorToastTimer.current)
  }, [])
  useEffect(() => {
    function outside(event: MouseEvent) { if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false) }
    document.addEventListener('mousedown', outside); return () => document.removeEventListener('mousedown', outside)
  }, [])
  useEffect(() => {
    let current = true; setLoading(true); setAnnouncementError(''); setConversationError(''); setClassroomError(''); setHomeroomError(''); setStudentError('')
    Promise.allSettled([
      api<Announcement[]>('/api/announcements', token),
      api<Conversation[]>('/api/messages/conversations', token),
      api<Classroom[]>('/api/teacher/classrooms', token),
      api<Classroom[]>('/api/teacher/classrooms/homeroom', token),
      api<Student[]>('/api/teacher/students', token),
    ]).then(([announcementsResult, conversationsResult, classroomsResult, homeroomResult, studentsResult]) => {
      if (!current) return
      const results = [announcementsResult, conversationsResult, classroomsResult, homeroomResult, studentsResult]
      if (results.some((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401)) { handleSessionExpired(); return }
      if (announcementsResult.status === 'fulfilled') setAnnouncements((announcementsResult.value ?? []).slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
      else setAnnouncementError(errorText(announcementsResult.reason))
      if (conversationsResult.status === 'fulfilled') setConversations((conversationsResult.value ?? []).slice().sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)))
      else setConversationError(errorText(conversationsResult.reason))
      if (classroomsResult.status === 'fulfilled') setClassrooms((classroomsResult.value ?? []).slice().sort((a, b) => a.gradeLevel - b.gradeLevel || a.sectionName.localeCompare(b.sectionName)))
      else if (classroomsResult.reason instanceof ApiError && classroomsResult.reason.status === 404) setClassroomError('The classroom directory is missing from the running API. Restart the backend with this teacher-workspace branch.')
      else setClassroomError(errorText(classroomsResult.reason))
      if (homeroomResult.status === 'fulfilled') setHomeroomClassrooms((homeroomResult.value ?? []).slice().sort((a, b) => a.gradeLevel - b.gradeLevel || a.sectionName.localeCompare(b.sectionName)))
      else if (homeroomResult.reason instanceof ApiError && homeroomResult.reason.status === 404) setHomeroomError('Homeroom classes are not available in the running API yet. Restart the backend with this teacher-workspace branch.')
      else setHomeroomError(errorText(homeroomResult.reason))
      if (studentsResult.status === 'fulfilled') setStudents((studentsResult.value ?? []).slice().sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)))
      else if (studentsResult.reason instanceof ApiError && studentsResult.reason.status === 404) setStudentError('The school student directory is not available in the running API yet. Restart the backend with this teacher-workspace branch.')
      else setStudentError(errorText(studentsResult.reason))
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [token, revision])
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
    let current = true; setThreadLoading(true); setThreadError('')
    api<ConversationDetail>('/api/messages/conversations/' + route.conversationId, token)
      .then((value) => { if (current) setDetail(value) })
      .catch((error) => { if (!current) return; if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else setThreadError(errorText(error)) })
      .finally(() => { if (current) setThreadLoading(false) })
    return () => { current = false }
  }, [route.conversationId, token, revision])

  const classFilteredAnnouncements = useMemo(() => filter === 'all' ? announcements : announcements.filter((item) => item.targetClassrooms?.some((room) => String(classroomId(room)) === filter)), [announcements, filter])
  const visibleAnnouncements = useMemo(() => {
    if (route.page !== 'announcements') return classFilteredAnnouncements
    const query = announcementQuery.trim().toLocaleLowerCase()
    return classFilteredAnnouncements.filter((item) => (announcementTypeFilter === 'all' || item.type === announcementTypeFilter)
      && (!query || [item.title, item.body, item.authorDisplayName, audience(item)].some((value) => value?.toLocaleLowerCase().includes(query))))
  }, [classFilteredAnnouncements, announcementQuery, announcementTypeFilter, route.page])
  const visibleStudents = useMemo(() => {
    const query = studentQuery.trim().toLocaleLowerCase()
    return students.filter((student) => !query || [student.firstName, student.lastName, student.schoolNumber, student.gradeLevel + '-' + student.sectionName]
      .some((value) => String(value).toLocaleLowerCase().includes(query)))
  }, [students, studentQuery])
  const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0)
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username
  const greetingName = profile.firstName || profile.username
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const selectedConversation = detail?.conversation ?? conversations.find((item) => item.id === route.conversationId) ?? null
  const selectedAnnouncement = announcements.find((item) => item.id === route.announcementId) ?? null
  const selectedProfileAnimal = (value: AccountAppearance) => profileAnimalOptions.find((animal) => animal.id === value.animal)

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

  async function saveAppearance() {
    setAppearanceSaving(true); setProfileStatus('')
    try {
      const saved = await api<AccountAppearance>('/api/auth/appearance', token, { method: 'PUT', body: JSON.stringify(appearanceDraft) })
      setAccountAppearance(saved); setAppearanceDraft(saved); setProfileStatus('Your avatar has been saved to your account.')
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
    if (emailDraft.trim().toLocaleLowerCase() === savedEmail.trim().toLocaleLowerCase()) { setProfileStatus('This email address is already saved.'); return }
    setProfileSaving(true); setProfileStatus('')
    try {
      await api('/api/auth/email', token, { method: 'PUT', body: JSON.stringify({ email: emailDraft.trim() }) })
      setSavedEmail(emailDraft.trim()); setEmailVerified(false); setVerificationSent(false); setVerificationCode(''); setProfileStatus('Email saved. Verify it before using it for password recovery.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setProfileSaving(false) }
  }

  async function sendVerificationCode() {
    setProfileSaving(true); setProfileStatus('')
    try {
      await api('/api/auth/email-verification/request', token, { method: 'POST' })
      setVerificationSent(true); setProfileStatus('A six-digit code has been sent to your email.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setProfileSaving(false) }
  }

  async function confirmVerification(event: FormEvent) {
    event.preventDefault(); setProfileSaving(true); setProfileStatus('')
    try {
      await api<void>('/api/auth/email-verification/confirm', token, { method: 'POST', body: JSON.stringify({ code: verificationCode }) })
      setEmailVerified(true); setVerificationSent(false); setVerificationCode(''); setProfileStatus('Your email address is verified.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setProfileSaving(false) }
  }

  async function savePhone() {
    setProfileSaving(true); setProfileStatus('')
    try {
      const updated = await api<Profile>('/api/auth/phone', token, { method: 'PUT', body: JSON.stringify({ phoneNumber: phoneDraft.trim() }) })
      setPhoneDraft(updated.phoneNumber || ''); setProfileStatus('Your phone number has been updated.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setProfileSaving(false) }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8 || newPassword.length > 20) { notifyError('Your new password must be 8 to 20 characters long.'); return }
    if (newPassword !== passwordConfirmation) { notifyError('The new password and confirmation do not match.'); return }
    setPasswordSaving(true); setProfileStatus('')
    try {
      await api<void>('/api/auth/change-password', token, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
      setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation('')
      setProfileStatus('Your password has been changed.')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setPasswordSaving(false) }
  }

  function navigate(next: Route, replace = false) {
    const hash = routeHash(next)
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
    setProfileOpen(false)
    if (!replace && window.location.hash === hash) { setRoute(next); return }
    const label = next.page === 'announcements' || next.page === 'announcement-detail' || next.page === 'new-announcement' ? 'the noticeboard'
      : next.page === 'messages' || next.page === 'new-message' ? 'your messages'
        : next.page === 'classes' || next.page === 'class-detail' ? 'your classroom' : 'your school day'
    const isDetail = next.page === 'announcement-detail' || next.page === 'class-detail' || (next.page === 'messages' && next.conversationId !== undefined)
    setTransitionIsDetail(isDetail)
    setTransitionLabel(label)
    if (soundEnabled) playWoodKnocks()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    navigationTimer.current = window.setTimeout(() => {
      if (replace) window.history.replaceState(window.history.state, '', hash)
      else window.history.pushState({}, '', hash)
      setRoute(next); setTransitionLabel(''); navigationTimer.current = null
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    }, reducedMotion ? 0 : isDetail ? 1250 : 1400)
  }
  function openNewAnnouncement() { setTitle(''); setBody(''); setCategory('GENERAL'); setAnnouncementFiles([]); setSelectedClassrooms([]); setPostStatus(''); navigate({ page: 'new-announcement' }) }
  function handleAnnouncementFiles(event: ChangeEvent<HTMLInputElement>) { setAnnouncementFiles(Array.from(event.currentTarget.files ?? [])) }
  function handleMessageFiles(event: ChangeEvent<HTMLInputElement>) { setMessageFiles(Array.from(event.currentTarget.files ?? [])) }
  function handleNewMessageFiles(event: ChangeEvent<HTMLInputElement>) { setNewMessageFiles(Array.from(event.currentTarget.files ?? [])) }
  function toggleClassroom(id: number) { const value = String(id); setSelectedClassrooms((old) => old.includes(value) ? old.filter((item) => item !== value) : [...old, value]) }
  function selectAllClassrooms(checked: boolean) { setSelectedClassrooms(checked ? classrooms.map((room) => String(room.id)) : []) }
  function toggleStudent(id: number) { setSelectedStudentIds((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id]) }
  function selectAllVisibleStudents(checked: boolean) {
    setSelectedStudentIds((old) => checked ? [...new Set([...old, ...visibleStudents.map((student) => student.id)])] : old.filter((id) => !visibleStudents.some((student) => student.id === id)))
  }

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
  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !body.trim() || selectedClassrooms.length === 0 || posting) return
    setPosting(true)
    let savedAnnouncement: Announcement | null = null
    try {
      savedAnnouncement = await api<Announcement>('/api/announcements', token, { method: 'POST', body: JSON.stringify({ title: title.trim(), body: body.trim(), type: category, targetClassroomIds: selectedClassrooms.map(Number) }) })
      for (const file of announcementFiles) await uploadFile('/api/announcements/' + savedAnnouncement.id + '/attachments', file)
      setPostStatus('Your announcement has been shared.'); setRevision((value) => value + 1); navigate({ page: 'announcements' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) handleSessionExpired()
      else if (savedAnnouncement) { setPostStatus('Your announcement has been shared.'); notifyError('The announcement was shared, but one or more files could not be attached. ' + errorText(error)); setRevision((value) => value + 1); navigate({ page: 'announcements' }) }
      else notifyError(errorText(error))
    }
    finally { setPosting(false) }
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!route.conversationId || (!draft.trim() && messageFiles.length === 0) || sending) return
    setSending(true); setThreadError('')
    try {
      const message = await api<DirectMessage>('/api/messages/conversations/' + route.conversationId + '/messages', token, { method: 'POST', body: JSON.stringify({ message: draft.trim() || 'Attachment' }) })
      setDetail((old) => old ? { ...old, messages: [...old.messages, { ...message, attachments: [] }] } : old)
      setDraft(''); setMessageFiles([]); setRevision((value) => value + 1)
      const uploaded: Attachment[] = []
      for (const file of messageFiles) uploaded.push(await uploadFile('/api/messages/conversations/' + route.conversationId + '/messages/' + message.id + '/attachments', file))
      if (uploaded.length) setDetail((old) => old ? { ...old, messages: old.messages.map((item) => item.id === message.id ? { ...item, attachments: uploaded } : item) } : old)
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError('The message could not be sent or an attachment could not be uploaded. ' + errorText(error)) }
    finally { setSending(false) }
  }
  async function startNewMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStudentIds.length || !newMessageDraft.trim() || sendingNewMessage) return
    setSendingNewMessage(true); setNewMessageStatus('')
    try {
      const filesToSend = newMessageFiles
      const started = await api<Conversation[]>('/api/messages/conversations/students', token, {
        method: 'POST', body: JSON.stringify({ studentProfileIds: selectedStudentIds, message: newMessageDraft.trim() }),
      })
      let attachmentFailures = 0
      if (filesToSend.length) {
        for (const conversation of started) {
          try {
            const conversationDetail = await api<ConversationDetail>('/api/messages/conversations/' + conversation.id, token)
            const firstMessage = conversationDetail.messages[conversationDetail.messages.length - 1]
            if (!firstMessage) { attachmentFailures += filesToSend.length; continue }
            for (const file of filesToSend) await uploadFile('/api/messages/conversations/' + conversation.id + '/messages/' + firstMessage.id + '/attachments', file)
          } catch { attachmentFailures += filesToSend.length }
        }
      }
      setRevision((value) => value + 1)
      setSelectedStudentIds([]); setNewMessageDraft(''); setNewMessageFiles([])
      const messageStatus = started.length === 1 ? 'Your message has been sent.' : 'Message sent in ' + started.length + ' separate student conversations.'
      setNewMessageStatus(messageStatus)
      if (attachmentFailures) notifyError(attachmentFailures + ' attachment' + (attachmentFailures === 1 ? ' could' : 's could') + ' not be added. Your message was sent.')
      if (started.length === 1) navigate({ page: 'messages', conversationId: started[0].id })
      else navigate({ page: 'messages' })
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleSessionExpired(); else notifyError(errorText(error)) }
    finally { setSendingNewMessage(false) }
  }
  const attachmentLinks = (attachments: Attachment[] | undefined, pathFor: (id: number) => string) => attachments?.length ? <div className="teacher-attachments">{attachments.map((file) => <button key={file.id} type="button" onClick={() => void downloadFile(pathFor(file.id), file.displayFilename)}><span aria-hidden="true">↧</span>{file.displayFilename}<small>{attachmentSize(file.size)}</small></button>)}</div> : null

  return <main className="teacher-workspace">
    <header className="teacher-topbar">
      <button className="teacher-brand" type="button" onClick={() => navigate({ page: 'today' })} aria-label="ClassBridge home"><img src="/images/classbridge-bridge-logo.png" alt="ClassBridge" /></button>
      <nav className="teacher-nav" aria-label="Teacher workspace">{([['today', 'Today'], ['announcements', 'Announcements'], ['messages', 'Messages'], ['classes', 'My classes']] as const).map(([page, label], index) => { const active = route.page === page || (page === 'announcements' && (route.page === 'announcement-detail' || route.page === 'new-announcement')) || (page === 'messages' && (route.conversationId !== undefined || route.page === 'new-message')) || (page === 'classes' && route.page === 'class-detail'); return <button className={'teacher-nav-link' + (active ? ' is-active' : '')} key={page} onClick={() => navigate({ page })} type="button" aria-current={active ? 'page' : undefined}><span className="teacher-nav-index">0{index + 1}</span>{label}{page === 'messages' && unread > 0 && <span className="teacher-nav-count">{unread}</span>}</button> })}</nav>
      <div className="teacher-top-actions">
        <button className="teacher-theme-button" onClick={onToggleTheme} type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M2 12h2m16 0h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.2 8.2 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></svg>}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
        <button className={'teacher-sound-button' + (soundEnabled ? ' is-on' : '')} onClick={() => setSoundEnabled((value) => !value)} type="button" aria-label={soundEnabled ? 'Turn page transition sounds off' : 'Turn page transition sounds on'} aria-pressed={soundEnabled} title={soundEnabled ? 'Transition sound on' : 'Transition sound off'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l4 3V7l-4 3H4Z" /><path d={soundEnabled ? 'M15 9a5 5 0 0 1 0 6m2-8a8 8 0 0 1 0 10' : 'm16 9 5 6m0-6-5 6'} /></svg></button>
        <div className="teacher-profile-menu" ref={profileRef}><button className="teacher-user-button" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-haspopup="menu">{accountAvatar(accountAppearance)}<span className="teacher-user-name">{fullName}</span><span className="teacher-user-caret">⌄</span></button>{profileOpen && <div className="teacher-profile-dropdown" role="menu"><div className="teacher-profile-card">{accountAvatar(accountAppearance)}<strong>{fullName}</strong><small>{emailDraft || profile.username}</small><small>Teacher account</small></div><button role="menuitem" type="button" onClick={() => navigate({ page: 'profile' })}>My profile <span>Account settings</span></button><button role="menuitem" type="button" onClick={() => navigate({ page: 'messages' })}>Messages <span>{unread ? unread + ' unread' : 'Open inbox'}</span></button><button role="menuitem" type="button" onClick={() => navigate({ page: 'announcements' })}>School updates <span>Announcements</span></button><button className="teacher-profile-signout" role="menuitem" type="button" onClick={() => { setProfileOpen(false); setConfirmSignOut(true) }}>Sign out</button></div>}</div>
      </div>
    </header>

    <div className="teacher-page-content">
      {route.page === 'today' && <>
        <section className="teacher-welcome" aria-labelledby="welcome-title"><div className="teacher-mascot-frame teacher-mascot-pair teacher-mascot-interactive" tabIndex={0} title="Say hello to the ClassBridge beaver"><img className="teacher-pose-rest" src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><img className="teacher-pose-hover" src="/images/beaver-guide-wave.png" alt="" aria-hidden="true" /><span className="teacher-mascot-note">Here to help</span></div><div className="teacher-welcome-copy"><p className="teacher-date-line"><i /> {today.toUpperCase()} <b /> YOUR SCHOOL DAY</p><h1 id="welcome-title">Good day, {greetingName}.</h1><p>Here’s what’s happening across your school community today.</p></div><div className="teacher-welcome-action"><button className="teacher-primary-action" onClick={openNewAnnouncement} type="button"><span>＋</span> Write an announcement</button><small>Share a note with your school</small></div></section>
        {postStatus && <p className="teacher-action-status" role="status">{postStatus}</p>}
        <div className="teacher-dashboard-grid"><section className="teacher-noticeboard"><div className="teacher-section-heading"><div><p className="teacher-overline">THE SCHOOL NOTICEBOARD</p><h2>A few things to know</h2></div><button className="teacher-text-action" onClick={() => navigate({ page: 'announcements' })} type="button">All announcements <span>→</span></button></div>{announcementError && <div className="teacher-load-error" role="alert">Announcements could not be loaded: {announcementError}</div>}{loading ? <div className="teacher-empty-state">Checking the school noticeboard…</div> : visibleAnnouncements.length === 0 ? <div className="teacher-empty-state">{announcementError ? 'Try again after checking your connection.' : 'There are no announcements for this view yet.'}</div> : <><article className="teacher-featured-note"><div className="teacher-note-margin"><span>01</span><i /></div><div className="teacher-note-body"><div className="teacher-note-meta"><span className="teacher-note-tag">{categoryLabel(visibleAnnouncements[0].type)} · {audience(visibleAnnouncements[0])}</span><time>{stamp(visibleAnnouncements[0].createdAt)}</time></div><h3><button className="teacher-announcement-open" type="button" onClick={() => navigate({ page: 'announcement-detail', announcementId: visibleAnnouncements[0].id })}>{visibleAnnouncements[0].title}</button></h3><p>{visibleAnnouncements[0].body}</p>{attachmentLinks(visibleAnnouncements[0].attachments, (id) => '/api/announcements/' + visibleAnnouncements[0].id + '/attachments/' + id)}<div className="teacher-note-byline"><b>{initials(visibleAnnouncements[0].authorDisplayName || 'School')}</b><span>Shared by {visibleAnnouncements[0].authorDisplayName || 'your school'}</span></div></div></article><div className="teacher-list-heading"><h3>From your classrooms</h3><label><span className="sr-only">Filter by class</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All classes</option>{classrooms.map((room) => <option value={String(room.id)} key={room.id}>{classroomName(room)}</option>)}</select></label></div><div className="teacher-announcement-list">{visibleAnnouncements.slice(1, 4).map((item, index) => <article className="teacher-announcement-row" key={item.id}><span className="teacher-row-index">0{index + 2}</span><time>{stamp(item.createdAt)}</time><div><span className="teacher-row-audience">{categoryLabel(item.type)} · {audience(item)}</span><h4><button className="teacher-announcement-open" type="button" onClick={() => navigate({ page: 'announcement-detail', announcementId: item.id })}>{item.title}</button></h4><p>{item.body}</p><small>Shared by {item.authorDisplayName || 'your school'}</small></div><span className="teacher-row-arrow" aria-hidden="true">↗</span></article>)}</div></>}</section>
          <aside className="teacher-side-column"><section className="teacher-side-section"><div className="teacher-section-heading teacher-section-heading-small"><div><p className="teacher-overline">YOUR TEACHING SPACE</p><h2>Classes</h2></div><button className="teacher-round-action" type="button" aria-label="View all classes" onClick={() => navigate({ page: 'classes' })}>↗</button></div>{homeroomError && <div className="teacher-load-error" role="alert">{homeroomError}</div>}{homeroomClassrooms.length === 0 ? <div className="teacher-empty-state">{loading ? 'Finding your homeroom classes…' : 'No homeroom class has been assigned to you yet.'}</div> : <div className="teacher-class-list">{homeroomClassrooms.slice(0, 4).map((room, index) => <button className="teacher-class-row" key={room.id} onClick={() => navigate({ page: 'class-detail', classroomId: room.id })} type="button"><span className={'teacher-class-mark ' + (index % 2 === 0 ? 'moss' : 'river')}>{String(room.gradeLevel).padStart(2, '0')}</span><span className="teacher-class-copy"><strong>{room.gradeLevel}-{room.sectionName}</strong><span>Grade {room.gradeLevel} · Homeroom</span></span><span className="teacher-class-count">Open class →</span></button>)}</div>}</section>
            <section className="teacher-side-section teacher-conversations"><div className="teacher-section-heading teacher-section-heading-small"><div><p className="teacher-overline">A NOTE FROM HOME</p><h2>Conversations</h2></div><button className="teacher-text-action teacher-text-action-compact" onClick={() => navigate({ page: 'messages' })} type="button">Inbox <span>→</span></button></div>{conversationError && <div className="teacher-load-error" role="alert">Messages could not be loaded: {conversationError}</div>}{loading ? <div className="teacher-empty-state">Checking your inbox…</div> : conversations.length === 0 ? <div className="teacher-empty-state">{conversationError ? 'Try again after checking your connection.' : 'No conversations yet.'}</div> : <div className="teacher-conversation-list">{conversations.slice(0, 3).map((item, index) => <button className="teacher-conversation-row" key={item.id} onClick={() => navigate({ page: 'messages', conversationId: item.id })} type="button"><b className={'teacher-conversation-avatar ' + (index % 2 === 0 ? 'sage' : 'sand')}>{initials(item.otherParticipantDisplayName || 'School')}</b><span className="teacher-conversation-copy"><strong>{item.otherParticipantDisplayName}</strong><small>{item.studentDisplayName ? 'About ' + item.studentDisplayName : item.otherParticipantRole.replaceAll('_', ' ')}</small><span>{item.latestMessage || 'Open conversation'}</span></span><time>{stamp(item.lastMessageAt)}</time></button>)}</div>}<p className="teacher-quiet-note"><i /> {unread > 0 ? unread + ' message' + (unread === 1 ? '' : 's') + ' waiting for you.' : 'You are up to date with your school community.'}</p></section><section className="teacher-week-note"><b>✳</b><div><p className="teacher-overline">YOUR SCHOOL COMMUNITY</p><strong>Updates and conversations, together.</strong><span>ClassBridge keeps your school day connected.</span></div><i aria-hidden="true">↗</i></section></aside></div>
      </>}

      {route.page === 'profile' && <section className="teacher-page-section teacher-profile-page">
        <button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'today' })}>← Back to today</button>
        <div className="teacher-profile-heading"><div>{accountAvatar(accountAppearance, 'teacher-profile-hero-avatar')}<div><p className="teacher-overline">YOUR CLASSBRIDGE ACCOUNT</p><h1>My profile</h1><p>Keep your account details and portrait up to date.</p></div></div><span className="teacher-profile-role">Teacher</span></div>
        {profileStatus && <p className="teacher-profile-status" role="status">{profileStatus}</p>}
        <div className="teacher-profile-layout">
          <div className="teacher-profile-main-column">
            <section className="teacher-account-panel"><div className="teacher-profile-panel-heading"><div><p className="teacher-overline">ACCOUNT DETAILS</p><h2>Your information</h2></div><span className="teacher-readonly-mark">School managed</span></div>
              <div className="teacher-account-fields"><div><small>FULL NAME</small><strong>{fullName}</strong></div><div><small>USERNAME</small><strong>{profile.username}</strong></div><div><small>ROLE</small><strong>Teacher</strong></div></div>
              <p className="teacher-profile-note">Your name, username, and role are managed by your school and can’t be changed here.</p>
            </section>

            <section className="teacher-account-panel teacher-contact-panel"><div className="teacher-profile-panel-heading"><div><p className="teacher-overline">CONTACT DETAILS</p><h2>Ways to reach you</h2></div></div>
              <form className="teacher-profile-field-form" onSubmit={(event) => { event.preventDefault(); void saveEmail() }}><label htmlFor="teacher-profile-email">Email address <span className={'teacher-email-status' + (emailVerified ? ' is-verified' : '')}>{emailVerified ? 'Verified' : 'Not verified'}</span></label><div className="teacher-profile-inline-field"><input id="teacher-profile-email" type="email" autoComplete="email" maxLength={254} value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="you@example.com" /><button className="teacher-secondary-action" type="submit" disabled={profileSaving || !emailDraft.trim()}>{profileSaving ? 'Saving…' : 'Save email'}</button></div></form>
              {emailDraft && !emailVerified && <div className="teacher-verification-tools"><button className="teacher-text-action" disabled={profileSaving} onClick={() => void sendVerificationCode()} type="button">{verificationSent ? 'Send a new code' : 'Send verification code'} <span>→</span></button>{verificationSent && <form className="teacher-profile-inline-field teacher-code-form" onSubmit={confirmVerification}><label className="sr-only" htmlFor="teacher-email-code">Six-digit verification code</label><input id="teacher-email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" /><button className="teacher-secondary-action" type="submit" disabled={profileSaving || verificationCode.length !== 6}>{profileSaving ? 'Checking…' : 'Verify email'}</button></form>}</div>}
              <form className="teacher-profile-field-form" onSubmit={(event) => { event.preventDefault(); void savePhone() }}><label htmlFor="teacher-profile-phone">Phone number</label><div className="teacher-profile-inline-field"><input id="teacher-profile-phone" type="tel" autoComplete="tel" maxLength={32} value={phoneDraft} onChange={(event) => setPhoneDraft(event.target.value)} placeholder="Add your phone number" /><button className="teacher-secondary-action" type="submit" disabled={profileSaving || !phoneDraft.trim()}>{profileSaving ? 'Saving…' : 'Save number'}</button></div></form>
            </section>

            <section className="teacher-account-panel teacher-security-panel"><div className="teacher-profile-panel-heading"><div><p className="teacher-overline">SECURITY</p><h2>Change your password</h2></div></div>
              <form className="teacher-password-form" onSubmit={changePassword}>
                <div className="teacher-password-grid">
                  <label className="teacher-password-field" htmlFor="teacher-current-password">Current password<input id="teacher-current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                  <label className="teacher-password-field" htmlFor="teacher-new-password">New password<input id="teacher-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                  <label className="teacher-password-field" htmlFor="teacher-confirm-password">Confirm new password<input id="teacher-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label>
                </div>
                <div className="teacher-password-actions"><small>Use 8 to 20 characters. Your current password is required.</small><button className="teacher-primary-action" type="submit" disabled={passwordSaving || !currentPassword || !newPassword || !passwordConfirmation}>{passwordSaving ? 'Updating…' : 'Update password'}</button></div>
              </form>
            </section>
          </div>

          <aside className="teacher-profile-side-column">
            <section className="teacher-account-panel teacher-avatar-panel"><div className="teacher-profile-panel-heading"><div><p className="teacher-overline">YOUR PORTRAIT</p><h2>Choose an avatar</h2></div></div><div className="teacher-avatar-preview">{accountAvatar(appearanceDraft, 'teacher-avatar-preview-image')}<span><strong>{appearanceDraft.avatarType === 'PHOTO' ? 'Your photo' : appearanceDraft.avatarType === 'ANIMAL' ? (() => { const animal = selectedProfileAnimal(appearanceDraft); return animal ? `${animal.name} · ${animal.group === 'adult' ? 'Adult' : 'Student'}` : 'Animal portrait' })() : 'Your initials'}</strong><small>Everyone can choose from both portrait groups.</small></span></div>
              <div className="teacher-avatar-initial-choice"><button className={'teacher-avatar-choice' + (appearanceDraft.avatarType === 'INITIALS' ? ' is-selected' : '')} onClick={() => setAppearanceDraft({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })} type="button"><span className="teacher-avatar-option-initials">{initials(fullName)}</span><strong>Initials</strong></button></div>
              <div className="teacher-avatar-groups" aria-label="Animal portraits">
                {(['adult', 'student'] as const).map((group) => <section className="teacher-avatar-group" key={group} aria-labelledby={'teacher-avatar-group-' + group}><h3 id={'teacher-avatar-group-' + group}>{group === 'adult' ? 'For adults' : 'For students'}</h3><div className="teacher-avatar-options" role="group" aria-label={group === 'adult' ? 'Adult animal portraits' : 'Student animal portraits'}>{profileAnimalOptions.filter((animal) => animal.group === group).map((animal) => <button className={'teacher-avatar-choice' + (appearanceDraft.avatarType === 'ANIMAL' && appearanceDraft.animal === animal.id ? ' is-selected' : '')} key={animal.id} aria-label={`${animal.name} · ${group === 'adult' ? 'Adult' : 'Student'}`} aria-pressed={appearanceDraft.avatarType === 'ANIMAL' && appearanceDraft.animal === animal.id} title={`${animal.name} · ${group === 'adult' ? 'Adult' : 'Student'}`} onClick={() => setAppearanceDraft({ avatarType: 'ANIMAL', animal: animal.id, imageDataUrl: null })} type="button"><span className="teacher-avatar-option-animal" style={profileAnimalArt(animal)} /><strong>{animal.name}</strong></button>)}</div></section>)}
              </div>
              <label className="teacher-avatar-upload">＋ Upload a photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatarFile} /></label><small className="teacher-avatar-hint">JPG, PNG or WebP · up to 2 MB</small><button className="teacher-primary-action teacher-avatar-save" onClick={() => void saveAppearance()} disabled={appearanceSaving} type="button">{appearanceSaving ? 'Saving…' : 'Save avatar'}</button>
            </section>
            <section className="teacher-account-panel teacher-profile-shortcuts"><p className="teacher-overline">QUICK ACCESS</p><button type="button" onClick={() => navigate({ page: 'messages' })}><span>Messages</span><small>{unread ? unread + ' unread' : 'Open your inbox'}</small><b>↗</b></button><button type="button" onClick={() => navigate({ page: 'announcements' })}><span>School updates</span><small>Read recent announcements</small><b>↗</b></button><button className="teacher-profile-signout-link" type="button" onClick={() => setConfirmSignOut(true)}><span>Sign out</span><small>We’ll ask before ending your session</small><b>→</b></button></section>
          </aside>
        </div>
      </section>}

      {route.page === 'announcements' && <section className="teacher-page-section">
        <div className="teacher-page-title teacher-announcement-page-title"><div><p className="teacher-overline">THE SCHOOL NOTICEBOARD</p><h1>Announcements</h1><p>Find a school update or browse notices by type.</p></div><div className="teacher-notice-mascot teacher-mascot-pair teacher-mascot-interactive" tabIndex={0} role="img" aria-label="Beaver holding a megaphone; hover to announce" title="Hover to hear the latest news"><img className="teacher-pose-rest" src="/images/beaver-announcement-rest.png" alt="" /><img className="teacher-pose-hover" src="/images/beaver-announcement-cutout.png" alt="" /><span>Fresh from the noticeboard</span></div><button className="teacher-primary-action" onClick={openNewAnnouncement} type="button"><span>＋</span> Write an announcement</button></div>
        {postStatus && <p className="teacher-action-status" role="status">{postStatus}</p>}{announcementError && <div className="teacher-load-error" role="alert">{announcementError}</div>}
        <div className="teacher-announcement-tools"><label className="teacher-search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></svg><span className="sr-only">Search announcements</span><input value={announcementQuery} onChange={(event) => setAnnouncementQuery(event.target.value)} placeholder="Search announcements" /></label><label className="teacher-type-filter"><span>Announcement type</span><select value={announcementTypeFilter} onChange={(event) => setAnnouncementTypeFilter(event.target.value as 'all' | AnnouncementType)}><option value="all">All types</option>{announcementCategories.map((item) => <option value={item.value} key={item.value}>{item.title}</option>)}</select></label><span className="teacher-result-count">{visibleAnnouncements.length} {visibleAnnouncements.length === 1 ? 'notice' : 'notices'}</span></div>
        {loading ? <div className="teacher-empty-state">Loading announcements…</div> : announcements.length === 0 ? <div className="teacher-empty-state">No announcements to show yet.</div> : visibleAnnouncements.length === 0 ? <div className="teacher-empty-state">No notices match those filters. Try another search or type.</div> : <div className="teacher-full-announcement-list">{visibleAnnouncements.map((item, index) => <article className="teacher-announcement-row" key={item.id}><span className="teacher-row-index">{String(index + 1).padStart(2, '0')}</span><time>{stamp(item.createdAt)}</time><div><span className="teacher-row-audience">{categoryLabel(item.type)} · {audience(item)}</span><h4><button className="teacher-announcement-open" onClick={() => navigate({ page: 'announcement-detail', announcementId: item.id })} type="button">{item.title}</button></h4><p>{item.body}</p><small>Shared by {item.authorDisplayName || 'your school'}</small>{attachmentLinks(item.attachments, (id) => '/api/announcements/' + item.id + '/attachments/' + id)}</div><button className="teacher-row-arrow teacher-announcement-detail-arrow" aria-label={'Open announcement: ' + item.title} onClick={() => navigate({ page: 'announcement-detail', announcementId: item.id })} type="button">↗</button></article>)}</div>}
      </section>}

      {route.page === 'announcement-detail' && <section className="teacher-page-section teacher-announcement-detail-page"><button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'announcements' })}>← Back to announcements</button>{!selectedAnnouncement ? loading ? <div className="teacher-empty-state">Opening announcement…</div> : <div className="teacher-empty-state">This announcement is no longer available in your school noticeboard.</div> : <article className="teacher-announcement-detail-card"><div className="teacher-detail-margin"><span>{categoryLabel(selectedAnnouncement.type)}</span><i /></div><div className="teacher-detail-copy"><p className="teacher-overline">{audience(selectedAnnouncement).toUpperCase()}</p><h1>{selectedAnnouncement.title}</h1><div className="teacher-detail-byline"><span className="teacher-user-avatar">{initials(selectedAnnouncement.authorDisplayName || 'School')}</span><span><strong>{selectedAnnouncement.authorDisplayName || 'Your school'}</strong><small>{stamp(selectedAnnouncement.createdAt)}</small></span></div><div className="teacher-detail-body">{selectedAnnouncement.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{attachmentLinks(selectedAnnouncement.attachments, (id) => '/api/announcements/' + selectedAnnouncement.id + '/attachments/' + id)}</div></article>}</section>}

      {route.page === 'new-announcement' && <section className="teacher-page-section teacher-compose-page"><button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'announcements' })}>← Back to announcements</button><div className="teacher-compose-layout"><div><p className="teacher-overline">SHARE WITH YOUR SCHOOL</p><h1>Write an announcement</h1><p className="teacher-page-intro">Choose who should see this update, add the details, and attach a file if it helps.</p><div className="teacher-compose-aside teacher-compose-aside-megaphone"><img src="/images/beaver-announcement-cutout.png" alt="ClassBridge beaver with a megaphone" /><span><strong>A clear note goes a long way.</strong><small>Your announcement will appear on the school noticeboard.</small></span></div></div><form className="teacher-compose-form" onSubmit={publishAnnouncement}>
        <fieldset className="teacher-category-picker"><legend>Announcement type</legend><div className="teacher-category-options">{announcementCategories.map((item) => <label className={'teacher-category-option' + (category === item.value ? ' is-selected' : '')} key={item.value}><input type="radio" name="announcement-type" value={item.value} checked={category === item.value} onChange={() => setCategory(item.value)} /><span className={'teacher-category-illustration ' + item.mark}>{categoryIllustration(item.mark)}</span><span className="teacher-category-copy"><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</div></fieldset>
        <fieldset className="teacher-classroom-picker"><legend>Send to classrooms</legend><p>Select one or more classes in your school.</p>{classroomError && <div className="teacher-load-error" role="alert">{classroomError}</div>}{classrooms.length > 0 && <label className="teacher-select-all"><input type="checkbox" checked={selectedClassrooms.length === classrooms.length && classrooms.length > 0} onChange={(event) => selectAllClassrooms(event.target.checked)} /> Select all classrooms</label>}{classrooms.length === 0 ? <div className="teacher-empty-state">{loading ? 'Loading classrooms…' : 'No classrooms are available yet. Your school administrator can add them first.'}</div> : <div className="teacher-classroom-options">{classrooms.map((room) => <label key={room.id}><input type="checkbox" checked={selectedClassrooms.includes(String(room.id))} onChange={() => toggleClassroom(room.id)} /><span><strong>{room.gradeLevel}-{room.sectionName}</strong><small>{classroomName(room)}</small></span></label>)}</div>}</fieldset>
        <label>Title<input maxLength={255} onChange={(event) => setTitle(event.target.value)} placeholder="What is this announcement about?" required value={title} /></label><label>Message<textarea onChange={(event) => setBody(event.target.value)} placeholder="Write the details for families and students…" required rows={7} value={body} /></label>
        <div className="teacher-file-picker-group"><strong>Attachments</strong><small>PDF, JPG or PNG · up to 10 MB each</small><label className="teacher-file-picker"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5h14v-5" /></svg><span><strong>Choose files</strong><small>{announcementFiles.length ? announcementFiles.length + ' file' + (announcementFiles.length === 1 ? '' : 's') + ' selected' : 'Add a document or image'}</small></span><input type="file" aria-label="Choose announcement attachments" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={handleAnnouncementFiles} /></label></div>
        {announcementFiles.length > 0 && <div className="teacher-selected-files">{announcementFiles.map((file, index) => <span key={file.name + index}><b aria-hidden="true">↗</b> {file.name} <small>{attachmentSize(file.size)}</small></span>)}</div>}<div className="teacher-compose-footer"><button className="teacher-text-action" onClick={() => navigate({ page: 'announcements' })} type="button">Cancel</button><button className="teacher-primary-action" disabled={posting || classrooms.length === 0 || selectedClassrooms.length === 0} type="submit">{posting ? 'Sharing…' : 'Share announcement'}</button></div></form></div></section>}

      {route.page === 'new-message' && <section className="teacher-page-section teacher-new-message-page"><button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'messages' })}>← Back to inbox</button><div className="teacher-compose-layout"><div><p className="teacher-overline">SCHOOL COMMUNITY</p><h1 className="teacher-page-title-text">New message</h1><p className="teacher-page-intro">Choose one or more students in your school and send a private note to each conversation.</p><div className="teacher-compose-aside teacher-compose-aside-megaphone"><img src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><span><strong>One-to-one, school-safe messaging.</strong><small>Each student gets a separate conversation. Only students in your school are listed.</small></span></div></div><form className="teacher-new-message-form" onSubmit={startNewMessage}><div className="teacher-recipient-heading"><div><p className="teacher-overline">RECIPIENTS</p><h2>Choose students</h2></div><span>{selectedStudentIds.length} selected</span></div><label className="teacher-search-field teacher-student-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></svg><span className="sr-only">Search students</span><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search by name, school number or class" /></label>{studentError && <div className="teacher-load-error" role="alert">{studentError}</div>}{students.length > 0 && <label className="teacher-select-all"><input type="checkbox" checked={visibleStudents.length > 0 && visibleStudents.every((student) => selectedStudentIds.includes(student.id))} onChange={(event) => selectAllVisibleStudents(event.target.checked)} /> Select all {studentQuery ? 'matching students' : 'students'}</label>}{loading ? <div className="teacher-empty-state">Loading students in your school…</div> : students.length === 0 ? <div className="teacher-empty-state">{studentError ? 'Student messaging is unavailable until the updated school directory API is running.' : 'There are no active students with a message recipient in your school.'}</div> : visibleStudents.length === 0 ? <div className="teacher-empty-state">No students match that search.</div> : <div className="teacher-message-students">{visibleStudents.map((student) => <label className={selectedStudentIds.includes(student.id) ? 'is-selected' : ''} key={student.id}><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} /><span className="teacher-student-initials">{initials(student.firstName + ' ' + student.lastName)}</span><span className="teacher-student-summary"><strong>{student.firstName} {student.lastName}</strong><small>{student.gradeLevel}-{student.sectionName} · No. {student.schoolNumber}</small></span><i aria-hidden="true">✓</i></label>)}</div>}<label className="teacher-new-message-body">Message<textarea maxLength={5000} onChange={(event) => setNewMessageDraft(event.target.value)} placeholder="Write a private message to the selected students…" required rows={5} value={newMessageDraft} /><small>{newMessageDraft.length}/5000</small></label><div className="teacher-file-picker-group"><strong>Attachments</strong><small>PDF, JPG or PNG · up to 10 MB each</small><label className="teacher-file-picker"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5h14v-5" /></svg><span><strong>Choose files</strong><small>{newMessageFiles.length ? newMessageFiles.length + ' file' + (newMessageFiles.length === 1 ? '' : 's') + ' selected' : 'Add a document or image'}</small></span><input type="file" aria-label="Choose message attachments" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={handleNewMessageFiles} /></label></div>{newMessageFiles.length > 0 && <div className="teacher-selected-files">{newMessageFiles.map((file, index) => <span key={file.name + index}><b aria-hidden="true">↗</b> {file.name} <small>{attachmentSize(file.size)}</small></span>)}</div>}{newMessageStatus && <p className="teacher-action-status" role="status">{newMessageStatus}</p>}<div className="teacher-compose-footer"><button className="teacher-text-action" onClick={() => navigate({ page: 'messages' })} type="button">Cancel</button><button className="teacher-primary-action" disabled={sendingNewMessage || !selectedStudentIds.length || !newMessageDraft.trim()} type="submit">{sendingNewMessage ? 'Sending…' : 'Send to ' + selectedStudentIds.length}</button></div></form></div></section>}

      {route.page === 'messages' && (route.conversationId ? <section className="teacher-page-section"><button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'messages' })}>← Back to inbox</button><div className="teacher-thread-page"><header className="teacher-thread-header"><div><p className="teacher-overline">SCHOOL CONVERSATION</p><h1>{selectedConversation?.otherParticipantDisplayName || 'Conversation'}</h1><span>{selectedConversation?.studentDisplayName ? 'About ' + selectedConversation.studentDisplayName : selectedConversation?.otherParticipantRole.replaceAll('_', ' ')}</span></div></header>{newMessageStatus && <p className="teacher-action-status" role="status">{newMessageStatus}</p>}{threadError && <div className="teacher-load-error" role="alert">{threadError}</div>}{threadLoading ? <div className="teacher-empty-state">Opening conversation…</div> : detail && <><div className="teacher-thread-messages teacher-thread-page-messages">{detail.messages.map((message) => <article className={'teacher-message-bubble' + (message.senderAccountId === profile.userAccountId ? ' is-own' : '')} key={message.id}><span>{message.message}</span>{attachmentLinks(message.attachments, (id) => '/api/messages/conversations/' + route.conversationId + '/messages/' + message.id + '/attachments/' + id)}<small>{message.senderDisplayName} · {stamp(message.createdAt)}</small></article>)}</div>{detail.conversation.readOnly ? <p className="teacher-empty-state">This conversation is read-only.</p> : <form className="teacher-message-compose" onSubmit={sendMessage}><label className="sr-only" htmlFor="teacher-message-draft">Your message</label><textarea id="teacher-message-draft" maxLength={5000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply…" rows={3} value={draft} /><label className="teacher-message-attachment" title="Attach PDF, JPG or PNG"><span>＋ Attach file</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={handleMessageFiles} /></label><button className="teacher-primary-action" disabled={sending || (!draft.trim() && messageFiles.length === 0)} type="submit">{sending ? 'Sending…' : 'Send message'}</button></form>}{messageFiles.length > 0 && <div className="teacher-selected-files">{messageFiles.map((file, index) => <span key={file.name + index}>📎 {file.name} <small>{attachmentSize(file.size)}</small></span>)}</div>}</>}</div></section> : <section className="teacher-page-section"><div className="teacher-page-title teacher-message-page-title"><div><p className="teacher-overline">A NOTE FROM HOME</p><h1>Messages</h1><p>Your conversations with families and colleagues.</p></div><div className="teacher-message-mascot teacher-mascot-pair teacher-mascot-interactive" tabIndex={0} role="img" aria-label="Beaver holding letters; hover to lift the mail" title="Hover to see today's mail"><img className="teacher-pose-rest" src="/images/beaver-message-rest.png" alt="" /><img className="teacher-pose-hover" src="/images/beaver-message-raised.png" alt="" /></div><div className="teacher-message-list-actions"><span className="teacher-inbox-count">{unread} unread</span><button className="teacher-primary-action" onClick={() => { setStudentQuery(''); setSelectedStudentIds([]); setNewMessageDraft(''); setNewMessageFiles([]); setNewMessageStatus(''); navigate({ page: 'new-message' }) }} type="button"><span>＋</span> New message</button></div></div>{newMessageStatus && <p className="teacher-action-status" role="status">{newMessageStatus}</p>}{conversationError && <div className="teacher-load-error" role="alert">{conversationError}</div>}{loading ? <div className="teacher-empty-state">Loading conversations…</div> : conversations.length === 0 ? <div className="teacher-empty-state">No conversations to show yet. Start a new message to a student in your school.</div> : <div className="teacher-inbox-list">{conversations.map((item, index) => <button className="teacher-inbox-row" key={item.id} onClick={() => navigate({ page: 'messages', conversationId: item.id })} type="button"><b className={'teacher-conversation-avatar ' + (index % 2 === 0 ? 'sage' : 'sand')}>{initials(item.otherParticipantDisplayName || 'School')}</b><span><strong>{item.otherParticipantDisplayName}</strong><small>{item.studentDisplayName ? 'About ' + item.studentDisplayName : item.otherParticipantRole.replaceAll('_', ' ')}</small><span>{item.latestMessage || 'Open conversation'}</span></span><time>{stamp(item.lastMessageAt)}</time>{item.unreadCount > 0 && <i>{item.unreadCount}</i>}</button>)}</div>}</section>)}

      {route.page === 'classes' && <section className="teacher-page-section"><div className="teacher-page-title"><div><p className="teacher-overline">YOUR TEACHING SPACE</p><h1>My classes</h1><p>Only the homeroom classes assigned to you appear here.</p></div></div>{homeroomError && <div className="teacher-load-error" role="alert">{homeroomError}</div>}{loading ? <div className="teacher-empty-state">Loading your homeroom classes…</div> : homeroomClassrooms.length === 0 ? <div className="teacher-empty-state">No homeroom class has been assigned to you yet. Your school administrator can assign one.</div> : <div className="teacher-classroom-grid">{homeroomClassrooms.map((room, index) => <button className="teacher-classroom-card teacher-classroom-card-button" key={room.id} onClick={() => navigate({ page: 'class-detail', classroomId: room.id })} type="button"><span className={'teacher-class-mark ' + (index % 2 === 0 ? 'moss' : 'river')}>{String(room.gradeLevel).padStart(2, '0')}</span><span className="teacher-classroom-card-copy"><p className="teacher-overline">YOUR HOMEROOM</p><strong>{room.gradeLevel}-{room.sectionName}</strong><small>Open class and view students →</small></span><span className="teacher-classroom-card-arrow" aria-hidden="true">↗</span></button>)}</div>}</section>}

      {route.page === 'class-detail' && <section className="teacher-page-section"><button className="teacher-back-link" type="button" onClick={() => navigate({ page: 'classes' })}>← Back to my classes</button>{classDetailError && <div className="teacher-load-error" role="alert">{classDetailError}</div>}{classDetailLoading ? <div className="teacher-empty-state">Opening class…</div> : classroomDetail && <><div className="teacher-page-title"><div><p className="teacher-overline">YOUR HOMEROOM CLASS</p><h1>{classroomDetail.gradeLevel}-{classroomDetail.sectionName}</h1><p>{classroomDetail.students.length} active student profiles</p></div><span className="teacher-class-mark moss">{String(classroomDetail.gradeLevel).padStart(2, '0')}</span></div>{classroomDetail.students.length === 0 ? <div className="teacher-empty-state">There are no active student profiles in this classroom yet.</div> : <div className="teacher-student-profile-grid">{classroomDetail.students.map((student) => <article className="teacher-student-profile-card" key={student.id}><span className="teacher-student-initials">{initials(student.firstName + ' ' + student.lastName)}</span><div><strong>{student.firstName} {student.lastName}</strong><small>School number {student.schoolNumber}</small></div><span className="teacher-student-class">{student.gradeLevel}-{student.sectionName}</span></article>)}</div>}</>}</section>}
    </div>
    <footer className="teacher-footer"><span>ClassBridge</span><i /> A more connected school community <button onClick={() => setConfirmSignOut(true)} type="button">Sign out</button></footer>

    {transitionLabel && <div className={'teacher-route-transition' + (transitionIsDetail ? ' is-detail' : '')} role="status" aria-live="polite"><div className="teacher-transition-walker" aria-hidden="true"><div className="teacher-transition-beaver" /></div><p>Loading…</p></div>}

    {confirmSignOut && <div className="teacher-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSignOut(false) }} role="presentation"><section className="teacher-signout-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title"><button className="teacher-signout-close" onClick={() => setConfirmSignOut(false)} type="button" aria-label="Close">×</button><img src="/images/beaver-confused-v2.png" alt="ClassBridge beaver looks unsure about leaving" /><p className="teacher-overline">BEFORE YOU HEAD OUT</p><h2 id="signout-title">Ready to leave, {greetingName}?</h2><p>You can come back to your school space whenever you’re ready.</p><div><button className="teacher-text-action" onClick={() => setConfirmSignOut(false)} type="button">Stay here</button><button className="teacher-primary-action" onClick={onSignOut} type="button">Sign out</button></div></section></div>}

    {sessionExpired && <div className="teacher-modal-backdrop teacher-session-expired-backdrop" role="presentation"><section className="teacher-signout-modal teacher-session-expired-modal" role="dialog" aria-modal="true" aria-labelledby="session-expired-title"><img src="/images/beaver-sad-v2.png" alt="The ClassBridge beaver is sorry your session expired" /><p className="teacher-overline">A QUICK PAUSE</p><h2 id="session-expired-title">Your session has expired</h2><p>Please sign in again to continue to your school workspace.</p><div><button className="teacher-primary-action" onClick={onSessionExpired} type="button">Back to sign in</button></div></section></div>}

    {errorToast && <aside className="teacher-error-toast" role="alert"><img src="/images/beaver-sad-v2.png" alt="" /><div><strong>Something went wrong</strong><p>{errorToast}</p></div><button type="button" onClick={dismissErrorToast} aria-label="Dismiss error message">×</button></aside>}
  </main>
}
