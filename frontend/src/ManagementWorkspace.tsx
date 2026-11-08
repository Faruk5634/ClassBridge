import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import type { ThemeMode } from './LoginExperience'
import { fetchCached, invalidateCachedGetRequests } from './apiClient'
import SchoolSuppliesPattern from './SchoolSuppliesPattern'
import './ManagementWorkspace.css'

type ManagementRole = 'SUPERADMIN' | 'SCHOOL_ADMIN' | 'SCHOOL_VICE_ADMIN'
type Profile = { userAccountId: number; username: string; role: ManagementRole; firstName: string; lastName: string; email?: string | null; emailVerified?: boolean; phoneNumber?: string | null; schoolName?: string | null }
type Props = { theme: ThemeMode; token: string; profile: Profile; onToggleTheme: () => void; onSignOut: () => void; onSessionExpired: () => void }
type School = { id: number; name: string; educationLevel: 'PRIMARY' | 'MIDDLE' | 'HIGH_SCHOOL'; province: string; district: string }
type Classroom = { id: number; gradeLevel: number; sectionName: string; homeroomTeacherAccountId: number | null }
type Student = { id: number; classroomId: number; schoolNumber: string; firstName: string; lastName: string; gradeLevel: number; sectionName: string; active: boolean; parentUsername: string | null; studentUsername: string | null }
type StudentProfile = Student & { schoolId: number; createdAt: string; updatedAt: string; parentProfileId: number | null; parentFirstName: string | null; parentLastName: string | null; studentUserAccountId: number | null; studentEmail: string | null; studentEmailVerified: boolean; studentPhoneNumber: string | null; mustChangePassword: boolean }
type SchoolParent = { parentProfileId: number; userAccountId: number; username: string; firstName: string; lastName: string; email: string | null; emailVerified?: boolean; phoneNumber: string | null; active: boolean; mustChangePassword?: boolean; createdAt?: string; children: string[] }
type ParentLinkedStudent = { studentProfileId: number; firstName: string; lastName: string; gradeLevel: number; sectionName: string; parentProfileId: number | null; parentDisplayName: string | null }
type StudentPage = { content: Student[]; page: number; size: number; totalElements: number; totalPages: number }
type TeacherHomeroom = { classroomId: number; gradeLevel: number; sectionName: string }
type TeacherProfile = { userAccountId: number; staffProfileId: number; schoolMembershipId: number; schoolId: number; username: string; firstName: string; lastName: string; branch: string | null; email: string | null; emailVerified: boolean; phoneNumber: string | null; active: boolean; mustChangePassword: boolean; homeroomClassrooms: TeacherHomeroom[]; createdAt: string }
type TeacherPage = { content: TeacherProfile[]; page: number; size: number; totalElements: number; totalPages: number }
type Announcement = { id: number; title: string; body: string; type: string; authorDisplayName: string; targetClassrooms: { classroomId?: number; gradeLevel: number; sectionName: string }[]; attachments?: { id: number; displayFilename: string; contentType: string; size: number; createdAt: string }[]; createdAt: string }
type View = 'overview' | 'students' | 'studentCreate' | 'studentDetail' | 'teachers' | 'teacherCreate' | 'teacherDetail' | 'parents' | 'parentCreate' | 'parentDetail' | 'classrooms' | 'classroomCreate' | 'classroomDetail' | 'announcements' | 'announcementCreate' | 'announcementDetail' | 'messages' | 'messageCompose' | 'schools' | 'profile'
type PreviewForm = 'teacher' | 'teacherEdit' | 'parent' | 'classroom' | 'classroomEdit' | 'announcement' | 'announcementDelete' | null
type TeacherPreview = { id: number; firstName: string; lastName: string; username: string; email: string; homeroom: string; active: boolean }
type ParentPreview = { id: number; firstName: string; lastName: string; username: string; email: string; phone: string; children: string[] }
type PreviewRecord = TeacherPreview | ParentPreview | Classroom | null
type CreatedStudent = { id: number; classroomId: number; gradeLevel: number; sectionName: string; schoolNumber: string; firstName: string; lastName: string; active: boolean; parentUsername: string | null; studentUsername: string | null; initialPassword: string | null; createdAt: string }
type CreatedParent = { parentProfileId: number; userAccountId: number; username: string; firstName: string; lastName: string; email: string | null; phoneNumber: string | null; active: boolean; initialPassword: string }
type CreatedTeacher = { userAccountId: number; staffProfileId: number; schoolMembershipId: number; schoolId: number; username: string; firstName: string; lastName: string; branch: string | null; role: 'TEACHER'; email: string | null; phoneNumber: string | null; active: boolean; initialPassword: string; createdAt: string }
type AdminPasswordReset = { userAccountId: number; username: string; temporaryPassword: string }
type WorkspaceToast = { kind: 'error' | 'success'; message: string; retry?: () => void }
type AccountAppearance = { avatarType: 'INITIALS' | 'ANIMAL' | 'PHOTO'; animal: string | null; imageDataUrl: string | null }
type ProfileAnimal = { id: string; name: string; group: 'adult' | 'student'; column: number; row: number }
type Conversation = { id: number; schoolId: number; studentProfileId: number | null; studentDisplayName: string | null; otherParticipantAccountId: number; otherParticipantDisplayName: string; otherParticipantAppearance?: AccountAppearance; otherParticipantRole: string; readOnly: boolean; unreadCount: number; latestMessage: string | null; createdAt: string; lastMessageAt: string }
type DirectMessage = { id: number; senderAccountId: number; senderDisplayName: string; senderRole: string; message: string; createdAt: string; attachments: { id: number; displayFilename: string; contentType: string; size: number }[] }
type ConversationDetail = { conversation: Conversation; messages: DirectMessage[] }
type MessageRecipient = { accountId: number; role: string; displayName: string; studentProfileId: number | null; schoolNumber: string | null; schoolId: number }

class WorkspaceApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const response = await fetchCached(path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  if (!response.ok) {
    const text = await response.text()
    let message = `The request could not be completed (${response.status}).`
    try { message = (JSON.parse(text) as { message?: string }).message || message } catch { /* Keep the safe generic message. */ }
    throw new WorkspaceApiError(message, response.status)
  }
  return await response.json() as T
}

async function putJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetchCached(path, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    let message = `The request could not be completed (${response.status}).`
    try { message = (JSON.parse(text) as { message?: string }).message || message } catch { /* Keep the safe generic message. */ }
    throw new WorkspaceApiError(message, response.status)
  }
  return await response.json() as T
}

async function postJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetchCached(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    let message = `The request could not be completed (${response.status}).`
    try { message = (JSON.parse(text) as { message?: string }).message || message } catch { /* Keep the safe generic message. */ }
    throw new WorkspaceApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

async function postFile<T>(path: string, token: string, file: File): Promise<T> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetchCached(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body,
  }, 0)
  if (!response.ok) {
    const text = await response.text()
    let message = `The file could not be uploaded (${response.status}).`
    try { message = (JSON.parse(text) as { message?: string }).message || message } catch { /* Keep the safe generic message. */ }
    throw new WorkspaceApiError(message, response.status)
  }
  return await response.json() as T
}

async function deleteJson<T>(path: string, token: string): Promise<T> {
  const response = await fetchCached(path, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  if (!response.ok) {
    const text = await response.text()
    let message = `The request could not be completed (${response.status}).`
    try { message = (JSON.parse(text) as { message?: string }).message || message } catch { /* Keep the safe generic message. */ }
    throw new WorkspaceApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

const classroomSections = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))

function Icon({ name }: { name: 'overview' | 'students' | 'teachers' | 'parents' | 'classes' | 'announcements' | 'messages' | 'schools' | 'search' | 'sun' | 'moon' | 'arrow' | 'plus' | 'edit' | 'trash' }) {
  const paths: Record<typeof name, ReactNode> = {
    overview: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    students: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V20"/></>,
    teachers: <><path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z"/><path d="M6 9.2v5.3c3.7 3.1 8.3 3.1 12 0V9.2M21 8v6"/><path d="M8 19h8"/></>,
    parents: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 15a4.5 4.5 0 0 1 5 4.5v.5"/></>,
    classes: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/></>,
    announcements: <><path d="M4 14V9a2 2 0 0 1 2-2h4l8-4v17l-8-4H6a2 2 0 0 1-2-2Z"/><path d="m8 16 1.5 5h4L11 16M21 9v5"/></>,
    messages: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></>,
    schools: <><path d="m3 10 9-6 9 6M5 10v10h14V10M9 20v-6h6v6M2 20h20"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon: <path d="M20.3 15.2A8.5 8.5 0 0 1 8.8 3.7 8.5 8.5 0 1 0 20.3 15.2Z"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    edit: <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"/><path d="m13.8 6.7 3.5 3.5"/></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

const navByRole: Record<ManagementRole, { view: View; label: string; icon: Parameters<typeof Icon>[0]['name'] }[]> = {
  SCHOOL_ADMIN: [
    { view: 'overview', label: 'Overview', icon: 'overview' },
    { view: 'students', label: 'Students', icon: 'students' },
    { view: 'teachers', label: 'Teachers', icon: 'teachers' },
    { view: 'parents', label: 'Parents', icon: 'parents' },
    { view: 'classrooms', label: 'Classrooms', icon: 'classes' },
    { view: 'announcements', label: 'Announcements', icon: 'announcements' },
    { view: 'messages', label: 'Messages', icon: 'messages' },
  ],
  SCHOOL_VICE_ADMIN: [
    { view: 'overview', label: 'Overview', icon: 'overview' },
    { view: 'students', label: 'Students', icon: 'students' },
    { view: 'teachers', label: 'Teachers', icon: 'teachers' },
    { view: 'parents', label: 'Parents', icon: 'parents' },
    { view: 'classrooms', label: 'Classrooms', icon: 'classes' },
    { view: 'announcements', label: 'Announcements', icon: 'announcements' },
    { view: 'messages', label: 'Messages', icon: 'messages' },
  ],
  SUPERADMIN: [
    { view: 'overview', label: 'Overview', icon: 'overview' },
    { view: 'schools', label: 'Schools', icon: 'schools' },
    { view: 'messages', label: 'Messages', icon: 'messages' },
  ],
}

const viewTitle: Record<View, string> = { overview: 'Overview', students: 'Students', studentCreate: 'Add a student', studentDetail: 'Student details', teachers: 'Teachers', teacherCreate: 'Add a teacher', teacherDetail: 'Teacher details', parents: 'Parents', parentCreate: 'Add a parent', parentDetail: 'Parent details', classrooms: 'Classrooms', classroomCreate: 'Add a classroom', classroomDetail: 'Classroom details', announcements: 'Announcements', announcementCreate: 'New announcement', announcementDetail: 'Announcement details', messages: 'Messages', messageCompose: 'New message', schools: 'School directory', profile: 'My profile' }
const schoolLevelLabel: Record<School['educationLevel'], string> = { PRIMARY: 'Primary school', MIDDLE: 'Middle school', HIGH_SCHOOL: 'High school' }
const announcementLabel: Record<string, string> = { GENERAL: 'General notice', HOMEWORK: 'Homework', EXAM: 'Exam announcement', EXAM_RESULTS: 'Exam results', EVENT: 'School event' }
const teacherBranchOptions = [
  'Primary Education', 'Turkish Language', 'English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Science', 'Social Studies', 'History', 'Geography', 'Religious Culture and Ethics', 'Computer Science',
  'Physical Education', 'Music', 'Visual Arts', 'Guidance and Counseling',
]
const profileAnimalSpecies = ['Lion', 'Bear', 'Koala', 'Turtle', 'Owl', 'Hippo', 'Snake', 'Fox', 'Rabbit', 'Otter', 'Cheetah']
const profileAnimalOptions: ProfileAnimal[] = profileAnimalSpecies.flatMap((name, index) => (['adult', 'student'] as const).map((group) => ({
  id: name.toUpperCase() + '_' + group.toUpperCase(), name, group, column: index % 4, row: Math.floor(index / 4),
})))
function profileAnimalArt(animal: ProfileAnimal) {
  return {
    backgroundImage: `url('/images/profile-animals-${animal.group === 'adult' ? 'adults' : 'students'}.jpg')`,
    backgroundSize: '400% 400%',
    backgroundPosition: `${(animal.column / 3) * 100}% ${['0%', '44.44%', '88.89%'][animal.row] ?? '0%'}`,
  }
}

const teacherPreview: TeacherPreview[] = [
  { id: 1, firstName: 'Aylin', lastName: 'Kaya', username: 'aylin.kaya', email: 'aylin@example.edu', homeroom: 'Grade 9 · A', active: true },
  { id: 2, firstName: 'Mert', lastName: 'Demir', username: 'mert.demir', email: 'mert@example.edu', homeroom: 'Grade 9 · C', active: true },
  { id: 3, firstName: 'Ece', lastName: 'Yılmaz', username: 'ece.yilmaz', email: 'ece@example.edu', homeroom: 'Not assigned', active: true },
]
function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CB' }
function compareClassrooms(first: Classroom, second: Classroom) { return first.gradeLevel - second.gradeLevel || first.sectionName.localeCompare(second.sectionName, undefined, { sensitivity: 'base' }) }
function formatDate(value: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.' }

function ManagementMessageAvatar({ appearance, name }: { appearance?: AccountAppearance; name: string }) {
  const animal = profileAnimalOptions.find((option) => option.id === appearance?.animal)
  return <span className="management-message-avatar" aria-hidden="true">
    {appearance?.avatarType === 'PHOTO' && appearance.imageDataUrl ? <img src={appearance.imageDataUrl} alt="" /> : appearance?.avatarType === 'ANIMAL' && animal ? <span className="management-message-avatar-animal" style={profileAnimalArt(animal)} /> : initials(name)}
  </span>
}

function ManagementToast({ toast, onDismiss }: { toast: WorkspaceToast; onDismiss: () => void }) {
  const isError = toast.kind === 'error'
  return <aside className={`management-toast management-toast-${toast.kind}`} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'}>
    <img src={isError ? '/images/beaver-error-cutout.png' : '/images/beaver-success-cutout.png'} alt="" />
    <div><strong>{isError ? 'Something went wrong' : 'All set!'}</strong><p>{toast.message}</p>{toast.retry && <button className="management-toast-retry" type="button" onClick={() => { const action = toast.retry; onDismiss(); action?.() }}>Try again</button>}</div>
    <button className="management-toast-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button>
  </aside>
}

export default function ManagementWorkspace({ theme, token, profile, onToggleTheme, onSignOut, onSessionExpired }: Props) {
  const isSuperadmin = profile.role === 'SUPERADMIN'
  const [view, setView] = useState<View>('overview')
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [classroomDetail, setClassroomDetail] = useState<Classroom | null>(null)
  const [announcementDetail, setAnnouncementDetail] = useState<Announcement | null>(null)
  const [announcementDeleteTarget, setAnnouncementDeleteTarget] = useState<Announcement | null>(null)
  const [classroomRoster, setClassroomRoster] = useState<StudentPage | null>(null)
  const [classroomTeacherChoices, setClassroomTeacherChoices] = useState<TeacherProfile[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [students, setStudents] = useState<StudentPage | null>(null)
  const [studentDetail, setStudentDetail] = useState<StudentProfile | null>(null)
  const [teachers, setTeachers] = useState<TeacherPage | null>(null)
  const [teacherChoices, setTeacherChoices] = useState<TeacherProfile[]>([])
  const [teacherDetail, setTeacherDetail] = useState<TeacherProfile | null>(null)
  const [schoolParents, setSchoolParents] = useState<SchoolParent[]>([])
  const [parentDetail, setParentDetail] = useState<SchoolParent | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null)
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null)
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<number | null>(null)
  const [teacherCount, setTeacherCount] = useState(0)
  const [studentDetailLoading, setStudentDetailLoading] = useState(false)
  const [teacherDetailLoading, setTeacherDetailLoading] = useState(false)
  const [parentDetailLoading, setParentDetailLoading] = useState(false)
  const [classroomDetailLoading, setClassroomDetailLoading] = useState(false)
  const [announcementDetailLoading, setAnnouncementDetailLoading] = useState(false)
  const [announcementDeleteSaving, setAnnouncementDeleteSaving] = useState(false)
  const [classroomRosterLoading, setClassroomRosterLoading] = useState(false)
  const [classroomTeacherChoicesLoading, setClassroomTeacherChoicesLoading] = useState(false)
  const [classroomError, setClassroomError] = useState('')
  const [announcementError, setAnnouncementError] = useState('')
  const [classroomRosterError, setClassroomRosterError] = useState('')
  const [studentPage, setStudentPage] = useState(0)
  const [teacherPage, setTeacherPage] = useState(0)
  const [classroomPage, setClassroomPage] = useState(0)
  const [announcementPage, setAnnouncementPage] = useState(0)
  const [classroomRosterPage, setClassroomRosterPage] = useState(0)
  const [classroomGradeFilter, setClassroomGradeFilter] = useState('all')
  const [announcementTypeFilter, setAnnouncementTypeFilter] = useState('all')
  const [announcementClassroomFilter, setAnnouncementClassroomFilter] = useState('all')
  const [classroomFilter, setClassroomFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [showArchivedTeachers, setShowArchivedTeachers] = useState(false)
  const [showArchivedParents, setShowArchivedParents] = useState(false)
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [studentError, setStudentError] = useState('')
  const [teacherError, setTeacherError] = useState('')
  const [parentError, setParentError] = useState('')
  const [toast, setToast] = useState<WorkspaceToast | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [previewForm, setPreviewForm] = useState<PreviewForm>(null)
  const [previewRecord, setPreviewRecord] = useState<PreviewRecord>(null)
  const [previewQuery, setPreviewQuery] = useState('')
  const [teacherQuery, setTeacherQuery] = useState('')
  const [parentQuery, setParentQuery] = useState('')
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('')
  const [classroomQuery, setClassroomQuery] = useState('')
  const [announcementQuery, setAnnouncementQuery] = useState('')
  const [previewNotice, setPreviewNotice] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [showParentCreate, setShowParentCreate] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [conversationsError, setConversationsError] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientSchoolId, setRecipientSchoolId] = useState('')
  const [recipients, setRecipients] = useState<MessageRecipient[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<MessageRecipient | null>(null)
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [recipientsError, setRecipientsError] = useState('')
  const [newMessageDraft, setNewMessageDraft] = useState('')
  const [sendingNewMessage, setSendingNewMessage] = useState(false)
  const [savedEmail, setSavedEmail] = useState(profile.email || '')
  const [emailDraft, setEmailDraft] = useState(profile.email || '')
  const [emailVerified, setEmailVerified] = useState(Boolean(profile.emailVerified))
  const [phoneDraft, setPhoneDraft] = useState(profile.phoneNumber || '')
  const [savedPhone, setSavedPhone] = useState(profile.phoneNumber || '')
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [appearance, setAppearance] = useState<AccountAppearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceDraft, setAppearanceDraft] = useState<AccountAppearance>({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })
  const [appearanceLoading, setAppearanceLoading] = useState(false)
  const [appearanceSaving, setAppearanceSaving] = useState(false)
  const conversationsLoaded = useRef(false)
  const conversationsFetchedAt = useRef(0)
  const detailsCache = useRef(new Map<number, { detail: ConversationDetail; fetchedAt: number }>())
  const appearanceLoaded = useRef(false)
  const messageThreadRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | null>(null)

  const fullName = useMemo(() => [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username, [profile.firstName, profile.lastName, profile.username])
  const navItems = navByRole[profile.role]
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) ?? conversationDetail?.conversation ?? null
  const selectedAppearanceAnimal = profileAnimalOptions.find((animal) => animal.id === appearanceDraft.animal)
  const unreadMessageCount = conversations.reduce((total, item) => total + item.unreadCount, 0)

  useEffect(() => {
    function dismissProfileMenu(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    function closeProfileMenu(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', dismissProfileMenu)
    document.addEventListener('keydown', closeProfileMenu)
    return () => {
      document.removeEventListener('mousedown', dismissProfileMenu)
      document.removeEventListener('keydown', closeProfileMenu)
    }
  }, [])

  const dismissToast = useCallback(() => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = null
    setToast(null)
  }, [])
  const notify = useCallback((kind: WorkspaceToast['kind'], message: string, retry?: () => void) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast({ kind, message, retry })
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null
      setToast(null)
    }, retry ? 9000 : 6000)
  }, [])
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current) }, [])

  const refresh = useCallback(() => {
    invalidateCachedGetRequests(`Bearer ${token}`)
    setStudents(null)
    setReloadKey((value) => value + 1)
  }, [token])
  const sessionError = useCallback((reason: unknown) => {
    if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
    else notify('error', errorText(reason), refresh)
  }, [notify, onSessionExpired, refresh])

  useEffect(() => {
    let active = true
    setLoading(true)
    const load = isSuperadmin
      ? getJson<School[]>('/api/superadmin/schools', token).then((items) => { if (active) setSchools(items) })
      : Promise.all([
          getJson<Classroom[]>('/api/school-admin/classrooms', token),
          getJson<StudentPage>('/api/school-admin/students?active=true&page=0&size=1', token),
          getJson<TeacherPage>('/api/school-admin/teachers?active=true&page=0&size=1', token),
          getJson<Announcement[]>('/api/school-admin/announcements', token),
          getJson<SchoolParent[]>('/api/school-admin/parents', token),
        ]).then(([rooms, studentResult, teacherResult, notes, parents]) => {
          if (!active) return
          setClassrooms(rooms)
          setStudentCount(studentResult.totalElements)
          setTeacherCount(teacherResult.totalElements)
          setAnnouncements(notes)
          setSchoolParents(parents)
        })
    load.catch((reason: unknown) => { if (active) sessionError(reason) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isSuperadmin, reloadKey, sessionError, token])

  useEffect(() => {
    if (isSuperadmin || view !== 'students') return
    let active = true
    setStudentsLoading(true)
    setStudentError('')
    const query = new URLSearchParams({ active: String(!showArchived), page: String(studentPage), size: '12' })
    if (classroomFilter !== 'all') query.set('classroomId', classroomFilter)
    getJson<StudentPage>(`/api/school-admin/students?${query.toString()}`, token)
      .then((result) => { if (active) setStudents(result) })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else {
          const message = errorText(reason)
          setStudentError(message)
          setStudents(null)
          notify('error', message)
        }
      })
      .finally(() => { if (active) setStudentsLoading(false) })
    return () => { active = false }
  }, [classroomFilter, isSuperadmin, notify, onSessionExpired, showArchived, studentPage, token, view])

  useEffect(() => {
    if (isSuperadmin || view !== 'studentDetail' || selectedStudentId === null) return
    let active = true
    setStudentDetailLoading(true)
    setStudentDetail(null)
    getJson<StudentProfile>(`/api/school-admin/students/${selectedStudentId}`, token)
      .then((result) => { if (active) setStudentDetail(result) })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else {
          const message = errorText(reason)
          setStudentError(message)
          notify('error', message)
        }
      })
      .finally(() => { if (active) setStudentDetailLoading(false) })
    return () => { active = false }
  }, [isSuperadmin, notify, onSessionExpired, selectedStudentId, token, view])

  useEffect(() => {
    const timer = window.setTimeout(() => setTeacherSearchQuery(teacherQuery.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [teacherQuery])

  useEffect(() => {
    if (isSuperadmin || view !== 'teachers') return
    let active = true
    setTeachersLoading(true)
    setTeacherError('')
    const query = new URLSearchParams({ active: String(!showArchivedTeachers), query: teacherSearchQuery, page: String(teacherPage), size: '12' })
    getJson<TeacherPage>(`/api/school-admin/teachers?${query.toString()}`, token)
      .then((result) => { if (active) setTeachers(result) })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else {
          const message = errorText(reason)
          setTeacherError(message)
          setTeachers(null)
          notify('error', message)
        }
      })
      .finally(() => { if (active) setTeachersLoading(false) })
    return () => { active = false }
  }, [isSuperadmin, notify, onSessionExpired, reloadKey, showArchivedTeachers, teacherPage, teacherSearchQuery, token, view])

  useEffect(() => {
    if (isSuperadmin || view !== 'teacherDetail' || selectedTeacherId === null) return
    let active = true
    setTeacherDetailLoading(true)
    setTeacherDetail(null)
    setTeacherError('')
    Promise.all([
      getJson<TeacherProfile>(`/api/school-admin/teachers/${selectedTeacherId}`, token),
      getJson<TeacherPage>('/api/school-admin/teachers?active=true&page=0&size=100', token),
    ])
      .then(([teacher, availableTeachers]) => {
        if (!active) return
        setTeacherDetail(teacher)
        setTeacherChoices(availableTeachers.content)
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else {
          const message = errorText(reason)
          setTeacherError(message)
          notify('error', message)
        }
      })
      .finally(() => { if (active) setTeacherDetailLoading(false) })
    return () => { active = false }
  }, [isSuperadmin, notify, onSessionExpired, selectedTeacherId, token, view])

  useEffect(() => {
    if (isSuperadmin || view !== 'parentDetail' || selectedParentId === null) return
    let active = true
    setParentDetailLoading(true)
    setParentDetail(null)
    setParentError('')
    getJson<SchoolParent>(`/api/school-admin/parents/${selectedParentId}`, token)
      .then((result) => { if (active) setParentDetail(result) })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else {
          const message = errorText(reason)
          setParentError(message)
          notify('error', message)
        }
      })
      .finally(() => { if (active) setParentDetailLoading(false) })
    return () => { active = false }
  }, [isSuperadmin, notify, onSessionExpired, selectedParentId, token, view])

  useEffect(() => {
    if (isSuperadmin || view !== 'classroomDetail' || selectedClassroomId === null) return
    let active = true
    setClassroomDetailLoading(true)
    setClassroomError('')
    getJson<Classroom>(`/api/school-admin/classrooms/${selectedClassroomId}`, token)
      .then((result) => {
        if (!active) return
        setClassroomDetail(result)
        setClassrooms((current) => current.map((room) => room.id === result.id ? result : room))
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else {
          const message = errorText(reason)
          setClassroomError(message)
          notify('error', message)
        }
      })
      .finally(() => { if (active) setClassroomDetailLoading(false) })
    return () => { active = false }
  }, [isSuperadmin, notify, onSessionExpired, selectedClassroomId, token, view])

  useEffect(() => {
    if (isSuperadmin || view !== 'announcementDetail' || selectedAnnouncementId === null) return
    let active = true
    setAnnouncementDetailLoading(true)
    setAnnouncementError('')
    getJson<Announcement>(`/api/school-admin/announcements/${selectedAnnouncementId}`, token)
      .then((result) => { if (active) setAnnouncementDetail(result) })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else {
          setAnnouncementError(errorText(reason))
          notify('error', errorText(reason))
        }
      })
      .finally(() => { if (active) setAnnouncementDetailLoading(false) })
    return () => { active = false }
  }, [isSuperadmin, notify, onSessionExpired, selectedAnnouncementId, token, view])

  useEffect(() => {
    if (isSuperadmin || (view !== 'classrooms' && view !== 'classroomCreate' && view !== 'classroomDetail')) return
    let active = true
    setClassroomTeacherChoicesLoading(true)
    getJson<TeacherPage>('/api/school-admin/teachers?active=true&page=0&size=100', token)
      .then((result) => { if (active) setClassroomTeacherChoices(result.content) })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else notify('error', errorText(reason))
      })
      .finally(() => { if (active) setClassroomTeacherChoicesLoading(false) })
    return () => { active = false }
  }, [isSuperadmin, notify, onSessionExpired, token, view])

  useEffect(() => {
    if (isSuperadmin || view !== 'classroomDetail' || selectedClassroomId === null) return
    let active = true
    setClassroomRosterLoading(true)
    setClassroomRosterError('')
    const query = new URLSearchParams({ active: 'true', page: String(classroomRosterPage), size: '12', classroomId: String(selectedClassroomId) })
    getJson<StudentPage>(`/api/school-admin/students?${query.toString()}`, token)
      .then((result) => { if (active) setClassroomRoster(result) })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else {
          const message = errorText(reason)
          setClassroomRosterError(message)
          notify('error', message)
        }
      })
      .finally(() => { if (active) setClassroomRosterLoading(false) })
    return () => { active = false }
  }, [classroomRosterPage, isSuperadmin, notify, onSessionExpired, selectedClassroomId, token, view])

  useEffect(() => {
    if (view !== 'messages' && view !== 'messageCompose') return
    const now = Date.now()
    if (conversationsLoaded.current && now - conversationsFetchedAt.current < 30_000) return
    let active = true
    setConversationsLoading(true)
    setConversationsError('')
    getJson<Conversation[]>('/api/messages/conversations', token)
      .then((items) => {
        if (!active) return
        setConversations(items)
        conversationsLoaded.current = true
        conversationsFetchedAt.current = Date.now()
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else { setConversationsError(errorText(reason)); notify('error', 'Your inbox could not be loaded. ' + errorText(reason)) }
      })
      .finally(() => { if (active) setConversationsLoading(false) })
    return () => { active = false }
  }, [notify, onSessionExpired, reloadKey, token, view])

  useEffect(() => {
    if (view !== 'messages' || selectedConversationId === null) return
    const cached = detailsCache.current.get(selectedConversationId)
    const listed = conversations.find((item) => item.id === selectedConversationId)
    const cachedMatchesList = !listed || listed.lastMessageAt === cached?.detail.conversation.lastMessageAt
    if (cached && cachedMatchesList && Date.now() - cached.fetchedAt < 30_000) {
      setConversationDetail(cached.detail)
      setThreadLoading(false)
      return
    }
    let active = true
    setThreadLoading(true)
    setThreadError('')
    getJson<ConversationDetail>(`/api/messages/conversations/${selectedConversationId}`, token)
      .then((detail) => {
        if (!active) return
        setConversationDetail(detail)
        detailsCache.current.set(selectedConversationId, { detail, fetchedAt: Date.now() })
        setConversations((items) => items.map((item) => item.id === selectedConversationId ? { ...item, latestMessage: detail.conversation.latestMessage, lastMessageAt: detail.conversation.lastMessageAt, unreadCount: 0 } : item))
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
        else { setThreadError(errorText(reason)); notify('error', 'This conversation could not be opened. ' + errorText(reason)) }
      })
      .finally(() => { if (active) setThreadLoading(false) })
    return () => { active = false }
  }, [conversations, notify, onSessionExpired, reloadKey, selectedConversationId, token, view])

  useEffect(() => {
    const query = recipientQuery.trim()
    if (view !== 'messageCompose' || selectedRecipient || query.length < 2 || (isSuperadmin && !recipientSchoolId)) {
      setRecipients([])
      setRecipientsLoading(false)
      return
    }
    let active = true
    setRecipientsLoading(true)
    setRecipientsError('')
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ query })
      if (isSuperadmin) params.set('schoolId', recipientSchoolId)
      getJson<MessageRecipient[]>(`/api/messages/recipients?${params.toString()}`, token)
        .then((items) => { if (active) setRecipients(items) })
        .catch((reason: unknown) => {
          if (!active) return
          if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
          else { setRecipientsError(errorText(reason)); notify('error', 'Recipients could not be searched. ' + errorText(reason)) }
        })
        .finally(() => { if (active) setRecipientsLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [isSuperadmin, notify, onSessionExpired, recipientQuery, recipientSchoolId, selectedRecipient, token, view])

  useEffect(() => {
    if (view !== 'profile' || appearanceLoaded.current) return
    let active = true
    setAppearanceLoading(true)
    getJson<AccountAppearance>('/api/auth/appearance', token)
      .then((saved) => {
        if (!active) return
        setAppearance(saved)
        setAppearanceDraft(saved)
        appearanceLoaded.current = true
      })
      .catch((reason: unknown) => { if (active) sessionError(reason) })
      .finally(() => { if (active) setAppearanceLoading(false) })
    return () => { active = false }
  }, [sessionError, token, view])

  useEffect(() => {
    if (view !== 'messages' || !conversationDetail) return
    const container = messageThreadRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [conversationDetail, view])

  const selectView = (next: View) => {
    setProfileOpen(false)
    setView(next)
  }
  const openConversation = (conversationId: number) => {
    setSelectedConversationId(conversationId)
    setConversationDetail(null)
    setThreadError('')
    setMessageDraft('')
    selectView('messages')
  }
  const openMessageCompose = () => {
    setRecipientQuery('')
    setRecipientSchoolId('')
    setRecipients([])
    setSelectedRecipient(null)
    setRecipientsError('')
    setNewMessageDraft('')
    selectView('messageCompose')
  }
  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const conversationId = selectedConversationId
    if (conversationId === null || !messageDraft.trim() || sendingMessage || conversationDetail?.conversation.readOnly) return
    setSendingMessage(true)
    setThreadError('')
    try {
      const sent = await postJson<DirectMessage>(`/api/messages/conversations/${conversationId}/messages`, token, { message: messageDraft.trim() })
      const currentDetail = conversationDetail?.conversation.id === conversationId ? conversationDetail : detailsCache.current.get(conversationId)?.detail
      if (currentDetail) {
        const updated: ConversationDetail = { ...currentDetail, conversation: { ...currentDetail.conversation, latestMessage: sent.message, lastMessageAt: sent.createdAt, unreadCount: 0 }, messages: [...currentDetail.messages, sent] }
        setConversationDetail(updated)
        detailsCache.current.set(conversationId, { detail: updated, fetchedAt: Date.now() })
      }
      setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, latestMessage: sent.message, lastMessageAt: sent.createdAt, unreadCount: 0 } : item).sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)))
      conversationsLoaded.current = true
      conversationsFetchedAt.current = Date.now()
      setMessageDraft('')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else { setThreadError(errorText(reason)); notify('error', 'The message could not be sent. ' + errorText(reason)) }
    } finally { setSendingMessage(false) }
  }
  const startConversation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRecipient || !newMessageDraft.trim() || sendingNewMessage) return
    setSendingNewMessage(true)
    try {
      const started = await postJson<Conversation>('/api/messages/conversations', token, {
        recipientAccountId: selectedRecipient.accountId,
        studentProfileId: selectedRecipient.studentProfileId,
        message: newMessageDraft.trim(),
      })
      detailsCache.current.delete(started.id)
      setConversations((items) => [started, ...items.filter((item) => item.id !== started.id)].sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)))
      conversationsLoaded.current = true
      conversationsFetchedAt.current = Date.now()
      setSelectedConversationId(started.id)
      setConversationDetail(null)
      setMessageDraft('')
      setNewMessageDraft('')
      selectView('messages')
      notify('success', `Your message to ${selectedRecipient.displayName} has been sent.`)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', 'The message could not be sent. ' + errorText(reason))
    } finally { setSendingNewMessage(false) }
  }
  const saveEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextEmail = emailDraft.trim()
    if (!nextEmail || nextEmail === savedEmail || profileSaving) return
    setProfileSaving(true)
    try {
      await putJson<{ message?: string }>('/api/auth/email', token, { email: nextEmail })
      setSavedEmail(nextEmail)
      setEmailDraft(nextEmail)
      setEmailVerified(false)
      setVerificationSent(false)
      setVerificationCode('')
      notify('success', 'Your email address has been updated. Verify it before using it for password recovery.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', 'The email address could not be updated. ' + errorText(reason))
    } finally { setProfileSaving(false) }
  }
  const savePhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPhone = phoneDraft.trim()
    if (!nextPhone || nextPhone === savedPhone || profileSaving) return
    setProfileSaving(true)
    try {
      const updated = await putJson<Profile>('/api/auth/phone', token, { phoneNumber: nextPhone })
      const saved = updated.phoneNumber || ''
      setSavedPhone(saved)
      setPhoneDraft(saved)
      notify('success', 'Your phone number has been saved.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', 'The phone number could not be saved. ' + errorText(reason))
    } finally { setProfileSaving(false) }
  }
  const requestEmailVerification = async () => {
    if (profileSaving || !savedEmail) return
    setProfileSaving(true)
    try {
      await postJson<{ message?: string }>('/api/auth/email-verification/request', token, {})
      setVerificationSent(true)
      notify('success', 'A verification code has been sent if email delivery is available.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', 'A verification code could not be requested. ' + errorText(reason))
    } finally { setProfileSaving(false) }
  }
  const confirmEmailVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (verificationCode.length !== 6 || profileSaving) return
    setProfileSaving(true)
    try {
      await postJson<void>('/api/auth/email-verification/confirm', token, { code: verificationCode })
      setEmailVerified(true)
      setVerificationSent(false)
      setVerificationCode('')
      notify('success', 'Your email address is verified.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', 'The verification code could not be confirmed. ' + errorText(reason))
    } finally { setProfileSaving(false) }
  }
  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (passwordSaving || newPassword.length < 8 || newPassword.length > 20 || newPassword !== passwordConfirmation) return
    setPasswordSaving(true)
    try {
      await postJson<void>('/api/auth/change-password', token, { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setPasswordConfirmation('')
      notify('success', 'Your password has been updated. Sign in again with your new password.')
      onSessionExpired()
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', 'The password could not be updated. ' + errorText(reason))
    } finally { setPasswordSaving(false) }
  }
  const selectProfilePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      notify('error', 'Choose a JPG, PNG, or WebP image no larger than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setAppearanceDraft({ avatarType: 'PHOTO', animal: null, imageDataUrl: reader.result })
    }
    reader.onerror = () => notify('error', 'The selected image could not be read.')
    reader.readAsDataURL(file)
  }
  const saveAppearance = async () => {
    if (appearanceSaving || appearanceLoading || JSON.stringify(appearance) === JSON.stringify(appearanceDraft)) return
    setAppearanceSaving(true)
    try {
      const saved = await putJson<AccountAppearance>('/api/auth/appearance', token, appearanceDraft)
      setAppearance(saved)
      setAppearanceDraft(saved)
      notify('success', 'Your portrait has been saved.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', 'Your portrait could not be saved. ' + errorText(reason))
    } finally { setAppearanceSaving(false) }
  }
  const downloadMessageAttachment = async (conversationId: number, messageId: number, attachment: DirectMessage['attachments'][number]) => {
    try {
      const response = await fetchCached(`/api/messages/conversations/${conversationId}/messages/${messageId}/attachments/${attachment.id}`, { headers: { Authorization: `Bearer ${token}` } }, 0)
      if (!response.ok) throw new WorkspaceApiError(`The file could not be downloaded (${response.status}).`, response.status)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.displayFilename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', 'The attachment could not be downloaded. ' + errorText(reason))
    }
  }
  const openStudentDetails = (student: Student) => {
    setSelectedStudentId(student.id)
    setStudentError('')
    setStudentDetail(null)
    selectView('studentDetail')
  }
  const returnToStudents = () => {
    setStudents(null)
    selectView('students')
  }
  const openStudentCreate = () => {
    setStudentError('')
    selectView('studentCreate')
  }
  const openTeacherDetails = (teacher: TeacherProfile) => {
    setSelectedTeacherId(teacher.userAccountId)
    setTeacherError('')
    setTeacherDetail(null)
    selectView('teacherDetail')
  }
  const returnToTeachers = () => {
    setTeachers(null)
    selectView('teachers')
  }
  const openParentDetails = (parent: SchoolParent) => {
    setSelectedParentId(parent.parentProfileId)
    setParentError('')
    setParentDetail(null)
    setParentDetailLoading(true)
    selectView('parentDetail')
  }
  const returnToParents = () => selectView('parents')
  const openClassroomDetails = (classroom: Classroom) => {
    setSelectedClassroomId(classroom.id)
    setClassroomRosterPage(0)
    setClassroomRoster(null)
    setClassroomError('')
    setClassroomDetail(classroom)
    selectView('classroomDetail')
  }
  const returnToClassrooms = () => {
    setClassroomDetail(null)
    setClassroomRoster(null)
    setClassroomPage(0)
    selectView('classrooms')
  }
  const openClassroomCreate = () => {
    setClassroomError('')
    selectView('classroomCreate')
  }
  const openAnnouncementDetails = (announcement: Announcement) => {
    setSelectedAnnouncementId(announcement.id)
    setAnnouncementDetail(announcement)
    setAnnouncementError('')
    selectView('announcementDetail')
  }
  const returnToAnnouncements = () => {
    setAnnouncementDetail(null)
    selectView('announcements')
  }
  const openAnnouncementCreate = () => selectView('announcementCreate')
  const handleAnnouncementCreated = (created: Announcement) => {
    setAnnouncements((current) => [created, ...current.filter((item) => item.id !== created.id)].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
    setAnnouncementQuery('')
    setAnnouncementTypeFilter('all')
    setAnnouncementClassroomFilter('all')
    setAnnouncementPage(0)
    selectView('announcements')
  }
  const confirmAnnouncementDelete = async () => {
    if (!announcementDeleteTarget || announcementDeleteSaving) return
    const target = announcementDeleteTarget
    setAnnouncementDeleteSaving(true)
    try {
      await deleteJson<void>(`/api/school-admin/announcements/${target.id}`, token)
      setAnnouncements((current) => current.filter((item) => item.id !== target.id))
      setAnnouncementPage(0)
      setAnnouncementDeleteTarget(null)
      if (selectedAnnouncementId === target.id) {
        setAnnouncementDetail(null)
        selectView('announcements')
      }
      notify('success', `“${target.title}” was removed from the school noticeboard.`)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else notify('error', errorText(reason))
    } finally { setAnnouncementDeleteSaving(false) }
  }
  const handleClassroomCreated = (created: Classroom) => {
    setClassrooms((current) => [...current.filter((room) => room.id !== created.id), created].sort(compareClassrooms))
    setClassroomQuery('')
    setClassroomGradeFilter('all')
    setClassroomPage(0)
    selectView('classrooms')
  }
  const handleClassroomSaved = (updated: Classroom) => {
    setClassrooms((current) => current.map((room) => room.id === updated.id ? updated : room).sort(compareClassrooms))
    setClassroomDetail(updated)
    setClassroomRoster((current) => current ? {
      ...current,
      content: current.content.map((student) => ({ ...student, gradeLevel: updated.gradeLevel, sectionName: updated.sectionName })),
    } : current)
    handleHomeroomChanged(updated)
  }
  const openParentCreate = () => {
    setParentError('')
    selectView('parentCreate')
  }
  const openTeacherCreate = () => {
    setTeacherError('')
    selectView('teacherCreate')
  }
  const handleStudentCreated = () => {
    setStudentCount((count) => count + 1)
    setShowArchived(false)
    setClassroomFilter('all')
    setStudentPage(0)
    setPreviewQuery('')
  }
  const handleStudentSaved = (updated: StudentProfile) => {
    if (studentDetail && studentDetail.active !== updated.active) {
      setStudentCount((count) => Math.max(0, count + (updated.active ? 1 : -1)))
    }
    setStudentDetail(updated)
    setStudents(null)
  }
  const handleTeacherCreated = () => {
    setTeacherCount((count) => count + 1)
    setShowArchivedTeachers(false)
    setTeacherPage(0)
    setTeacherQuery('')
    setTeachers(null)
  }
  const handleTeacherSaved = (updated: TeacherProfile) => {
    if (teacherDetail && teacherDetail.active !== updated.active) {
      setTeacherCount((count) => Math.max(0, count + (updated.active ? 1 : -1)))
    }
    setTeacherDetail(updated)
    setTeachers(null)
  }
  const handleHomeroomChanged = (updatedClassroom: Classroom) => {
    setClassrooms((current) => current.map((classroom) => classroom.id === updatedClassroom.id ? updatedClassroom : classroom))
    setTeacherDetail((current) => current ? {
      ...current,
      homeroomClassrooms: current.userAccountId === updatedClassroom.homeroomTeacherAccountId
        ? [...current.homeroomClassrooms.filter((room) => room.classroomId !== updatedClassroom.id), { classroomId: updatedClassroom.id, gradeLevel: updatedClassroom.gradeLevel, sectionName: updatedClassroom.sectionName }]
        : current.homeroomClassrooms.filter((room) => room.classroomId !== updatedClassroom.id),
    } : current)
  }
  const handleParentCreated = (created: CreatedParent | SchoolParent) => {
    setSchoolParents((current) => [{
      parentProfileId: created.parentProfileId,
      userAccountId: created.userAccountId,
      username: created.username,
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.email,
      emailVerified: 'emailVerified' in created ? created.emailVerified : undefined,
      phoneNumber: created.phoneNumber,
      active: created.active,
      mustChangePassword: 'mustChangePassword' in created ? created.mustChangePassword : true,
      createdAt: 'createdAt' in created ? created.createdAt : undefined,
      children: 'children' in created ? created.children : current.find((parent) => parent.parentProfileId === created.parentProfileId)?.children ?? [],
    }, ...current.filter((parent) => parent.parentProfileId !== created.parentProfileId)])
    setShowArchivedParents(false)
    setParentQuery('')
  }
  const handleParentSaved = (updated: SchoolParent) => {
    if (parentDetail && parentDetail.active !== updated.active) setShowArchivedParents(!updated.active)
    setParentDetail((current) => current?.parentProfileId === updated.parentProfileId ? updated : current)
    setSchoolParents((current) => current.map((parent) => parent.parentProfileId === updated.parentProfileId ? updated : parent))
  }
  const openPreviewForm = (form: Exclude<PreviewForm, null>, record: PreviewRecord = null) => {
    setPreviewNotice('')
    setPreviewForm(form)
    setPreviewRecord(record)
  }
  const closePreviewForm = () => {
    setPreviewForm(null)
    setPreviewRecord(null)
    setPreviewNotice('')
  }

  const viewDescription: Record<View, string> = {
    overview: isSuperadmin ? 'A considered view of the schools connected to ClassBridge.' : 'A clear view of the people, classrooms, and updates that bring your school together.',
    students: 'Review active and archived student profiles in your school.',
    studentCreate: 'Add a student profile to your school roster and assign a classroom.',
    studentDetail: 'Review and update this student’s school profile.',
    teachers: 'Manage the teacher accounts and homeroom assignments in your school.',
    teacherCreate: 'Create a teacher account and prepare its first sign-in details.',
    teacherDetail: 'Review and update this teacher’s school account.',
    parents: 'See the families connected to your school and link siblings to an existing account.',
    parentCreate: 'Create a parent sign-in or register an account the family already uses.',
    parentDetail: 'Review this shared family account and its links to students in your school.',
    classrooms: 'Create learning spaces, assign homeroom teachers, and organize class rosters.',
    classroomCreate: 'Add a learning space and assign its homeroom teacher.',
    classroomDetail: 'Update classroom details, manage its homeroom assignment, and review its student roster.',
    announcements: 'Create, review, and manage updates shared across your school community.',
    announcementCreate: 'Share a notice with selected classrooms in your school.',
    announcementDetail: 'Review this notice, its audience, and attached files.',
    messages: 'Keep in touch with colleagues and families in your school community.',
    messageCompose: 'Choose one person in your school and send a private note.',
    schools: 'Schools across the ClassBridge platform.',
    profile: 'Review the account details associated with your administrator profile.',
  }
  const classroomSearchTerm = classroomQuery.trim().toLowerCase()
  const filteredClassrooms = classrooms
    .filter((room) => classroomGradeFilter === 'all' || String(room.gradeLevel) === classroomGradeFilter)
    .filter((room) => `grade ${room.gradeLevel} ${room.sectionName} ${room.gradeLevel}-${room.sectionName}`.toLowerCase().includes(classroomSearchTerm))
    .sort(compareClassrooms)
  const classroomPageSize = 10
  const classroomTotalPages = Math.ceil(filteredClassrooms.length / classroomPageSize)
  const visibleClassrooms = filteredClassrooms.slice(classroomPage * classroomPageSize, (classroomPage + 1) * classroomPageSize)
  const announcementSearchTerm = announcementQuery.trim().toLowerCase()
  const filteredAnnouncements = announcements
    .filter((item) => announcementTypeFilter === 'all' || item.type === announcementTypeFilter)
    .filter((item) => announcementClassroomFilter === 'all' || item.targetClassrooms.some((room) => String(room.classroomId) === announcementClassroomFilter))
    .filter((item) => `${item.title} ${item.body} ${item.authorDisplayName} ${item.type} ${item.targetClassrooms.map((room) => `${room.gradeLevel}-${room.sectionName}`).join(' ')}`.toLowerCase().includes(announcementSearchTerm))
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
  const announcementPageSize = 8
  const announcementTotalPages = Math.ceil(filteredAnnouncements.length / announcementPageSize)
  const visibleAnnouncements = filteredAnnouncements.slice(announcementPage * announcementPageSize, (announcementPage + 1) * announcementPageSize)

  return <main className="management-workspace">
    <aside className="management-sidebar">
      <button className="management-brand" type="button" onClick={() => selectView('overview')} aria-label="ClassBridge overview">
        <img src="/images/classbridge-bridge-logo.png" alt="ClassBridge" />
        <span>MANAGEMENT</span>
      </button>
      <p className="management-nav-label">WORKSPACE</p>
      <nav className="management-nav" aria-label="Management workspace">
        {navItems.map((item) => { const isCurrent = view === item.view || (view === 'messageCompose' && item.view === 'messages') || ((view === 'studentDetail' || view === 'studentCreate') && item.view === 'students') || ((view === 'teacherDetail' || view === 'teacherCreate') && item.view === 'teachers') || ((view === 'parentDetail' || view === 'parentCreate') && item.view === 'parents') || ((view === 'classroomDetail' || view === 'classroomCreate') && item.view === 'classrooms') || ((view === 'announcementDetail' || view === 'announcementCreate') && item.view === 'announcements'); return <button key={item.view} className={'management-nav-link' + (isCurrent ? ' is-active' : '')} type="button" onClick={() => selectView(item.view)} aria-current={isCurrent ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span><i aria-hidden="true">→</i></button> })}
      </nav>
      <button className="management-sidebar-footer" type="button" onClick={() => selectView('profile')} aria-label="Open administrator profile">
        <span className="management-avatar">{initials(fullName)}</span><span><strong>{fullName}</strong><small>{profile.role === 'SCHOOL_VICE_ADMIN' ? 'Vice administrator' : isSuperadmin ? 'Superadmin' : 'School administrator'}</small></span><i aria-hidden="true">↗</i>
      </button>
    </aside>

    <section className="management-main">
      <header className="management-topbar"><div className="management-breadcrumb"><span>CLASSBRIDGE</span><i>/</i><strong>{isSuperadmin ? 'PLATFORM' : 'SCHOOL OFFICE'}</strong></div><div className="management-top-actions"><button className="management-theme-button" type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /><span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button><div className="management-user-menu" ref={profileMenuRef}><button className="management-user-button" type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu"><span className="management-avatar">{initials(fullName)}</span><span>{fullName}</span><i>⌄</i></button>{profileOpen && <div className="management-profile-dropdown" role="menu"><div className="management-profile-card"><span className="management-avatar">{initials(fullName)}</span><strong>{fullName}</strong><small>{savedEmail || profile.username}</small><small>{profile.schoolName || (isSuperadmin ? 'ClassBridge' : 'School administrator')}</small></div><button role="menuitem" type="button" onClick={() => selectView('profile')}>My profile <span>Account details</span></button><button role="menuitem" type="button" onClick={() => selectView('messages')}>Messages <span>{unreadMessageCount ? `${unreadMessageCount} unread` : 'Open inbox'}</span></button><button className="management-profile-signout" role="menuitem" type="button" onClick={onSignOut}>Sign out</button></div>}</div></div></header>

      <div className="management-content">
        {(view !== 'overview' || isSuperadmin) && <div className="management-page-heading"><div><p className="management-eyebrow">{isSuperadmin ? 'PLATFORM MANAGEMENT' : 'YOUR SCHOOL COMMUNITY'}</p><h1>{view === 'overview' ? `Welcome, ${profile.firstName || 'there'}.` : viewTitle[view]}</h1><p>{viewDescription[view]}</p></div><span className="management-role-pill">{profile.role.replaceAll('_', ' ')}</span></div>}

        {view === 'overview' && (isSuperadmin ? <>
          <div className="management-stat-grid"><article className="management-stat-card management-stat-featured"><span className="management-stat-icon"><Icon name="schools" /></span><small>REGISTERED SCHOOLS</small><strong>{loading ? '—' : schools.length}</strong><span>Across the ClassBridge network</span><i className="management-stat-spark" aria-hidden="true">⌁</i></article><article className="management-stat-card"><span className="management-stat-icon warm">⌂</span><small>SCHOOL LEVELS</small><strong>{loading ? '—' : new Set(schools.map((school) => school.educationLevel)).size}</strong><span>Primary, middle, and high school</span></article><article className="management-stat-card"><span className="management-stat-icon lilac">✦</span><small>SCHOOL LOCATIONS</small><strong>{loading ? '—' : new Set(schools.map((school) => `${school.district}, ${school.province}`)).size}</strong><span>Districts represented in the network</span></article></div>
          <section className="management-section-card"><div className="management-section-heading"><div><p className="management-eyebrow">SCHOOL NETWORK</p><h2>Recently added schools</h2></div><button type="button" onClick={() => selectView('schools')}>Open directory <Icon name="arrow" /></button></div>{loading ? <div className="management-empty">Loading the school directory…</div> : <SchoolList schools={schools.slice(0, 5)} />}</section>
        </> : <>
          <section className="management-welcome-card"><SchoolSuppliesPattern className="management-welcome-supplies"/><div className="management-welcome-copy"><span className="management-welcome-spark">✦</span><p className="management-eyebrow">YOUR SCHOOL OFFICE</p><h2>Hello, {profile.firstName || 'there'}.</h2><p>Welcome to <strong>{profile.schoolName || 'your school'}.</strong> Your school community is ready for you.</p></div><div className="management-welcome-art"><span className="management-art-orbit orbit-one"/><span className="management-art-orbit orbit-two"/><div className="management-mascot management-mascot-interactive" role="img" tabIndex={0} aria-label="ClassBridge beaver mascot. Here to help." title="Say hello to the ClassBridge beaver"><img className="management-pose-rest" src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot"/><img className="management-pose-hover" src="/images/beaver-guide-wave.png" alt="" aria-hidden="true"/><span className="management-art-bubble">Here to help</span></div></div></section>
          <div className="management-stat-grid"><button className="management-stat-card management-stat-featured" type="button" onClick={() => selectView('students')} aria-label="Open student directory"><span className="management-stat-icon"><img src="/images/role-student.png" alt="" /></span><small>ACTIVE STUDENTS</small><strong>{loading ? '—' : studentCount.toLocaleString('en')}</strong><span>Profiles in your school</span><i className="management-stat-spark" aria-hidden="true">⌁</i></button><button className="management-stat-card management-stat-featured" type="button" onClick={() => selectView('teachers')} aria-label="Open teacher directory"><span className="management-stat-icon warm"><img src="/images/role-teacher.png" alt="" /></span><small>TEACHERS</small><strong>{loading ? '—' : teacherCount.toLocaleString('en')}</strong><span>Teacher accounts in your school</span><i className="management-stat-spark" aria-hidden="true">⌁</i></button><button className="management-stat-card management-stat-featured" type="button" onClick={() => selectView('parents')} aria-label="Open parent directory"><span className="management-stat-icon lilac"><img src="/images/role-parent.png" alt="" /></span><small>PARENTS & GUARDIANS</small><strong>{loading ? '—' : schoolParents.filter((parent) => parent.active).length}</strong><span>Family accounts represented</span><i className="management-stat-spark" aria-hidden="true">⌁</i></button></div>
          <div className="management-overview-grid"><section className="management-section-card management-announcement-section"><div className="management-section-heading"><div><p className="management-eyebrow">THE NOTICEBOARD</p><h2>Recent announcements</h2></div><button type="button" onClick={() => selectView('announcements')}>View all <Icon name="arrow" /></button></div>{loading ? <div className="management-empty">Checking the school noticeboard…</div> : announcements.length ? <AnnouncementList items={announcements.slice(0, 4)} compact onOpen={openAnnouncementDetails} /> : <div className="management-empty">No announcements have been shared yet.</div>}</section><section className="management-section-card management-class-section"><div className="management-section-heading"><div><p className="management-eyebrow">LEARNING SPACES</p><h2>Classrooms</h2></div><button type="button" onClick={() => selectView('classrooms')}>Directory <Icon name="arrow" /></button></div>{loading ? <div className="management-empty">Loading classrooms…</div> : classrooms.length ? <ClassroomList rooms={classrooms.slice(0, 5)} /> : <div className="management-empty">No classrooms have been added yet.</div>}</section></div>
        </>)}

        {view === 'students' && <section className="management-section-card management-directory-card management-students-page"><div className="management-section-heading"><div className="management-student-heading-copy"><div><p className="management-eyebrow">SCHOOL ROSTER</p><h2>{showArchived ? 'Archived profiles' : 'Active students'}</h2></div><StudentRosterMascots /></div><button className="management-student-add-button" type="button" onClick={openStudentCreate}><Icon name="plus" /> Add student</button></div><div className="management-table-tools management-student-tools"><label className="management-search management-student-search"><Icon name="search" /><input value={previewQuery} onChange={(event) => setPreviewQuery(event.target.value)} placeholder="Search loaded students by name, number, or username" aria-label="Search loaded students by name, number, or username" /></label><label className="management-student-filter"><span>CLASSROOM</span><select aria-label="Filter students by classroom" value={classroomFilter} onChange={(event) => { setClassroomFilter(event.target.value); setStudentPage(0) }}><option value="all">All classrooms</option>{classrooms.map((room) => <option key={room.id} value={room.id}>Grade {room.gradeLevel} · {room.sectionName}</option>)}</select></label><div className="management-student-tabs" role="group" aria-label="Student profile status"><button className={!showArchived ? 'is-selected' : ''} type="button" aria-pressed={!showArchived} onClick={() => { setShowArchived(false); setStudentPage(0) }}>Active</button><button className={showArchived ? 'is-selected' : ''} type="button" aria-pressed={showArchived} onClick={() => { setShowArchived(true); setStudentPage(0) }}>Archived</button></div></div>{studentsLoading ? <div className="management-empty">Loading student profiles…</div> : studentError ? <div className="management-empty">Student profiles could not be loaded.</div> : students && <><StudentTable students={students.content.filter((student) => `${student.firstName} ${student.lastName} ${student.schoolNumber} ${student.studentUsername ?? ''}`.toLowerCase().includes(previewQuery.trim().toLowerCase()))} onOpen={openStudentDetails} /><div className="management-pagination management-student-pagination"><span>{students.totalElements.toLocaleString('en')} profiles</span><div><button type="button" disabled={studentPage <= 0} onClick={() => setStudentPage((page) => Math.max(0, page - 1))}>← Previous</button><span>Page {students.totalPages ? studentPage + 1 : 0} of {students.totalPages}</span><button type="button" disabled={studentPage + 1 >= students.totalPages} onClick={() => setStudentPage((page) => page + 1)}>Next →</button></div></div></>}</section>}
        {view === 'studentCreate' && <StudentCreatePage classrooms={classrooms} parents={schoolParents} token={token} onBack={returnToStudents} onSessionExpired={onSessionExpired} onNotify={notify} onCreated={handleStudentCreated} onAddParent={() => setShowParentCreate(true)} />}
        {view === 'studentDetail' && <StudentDetails student={studentDetail} classrooms={classrooms} loading={studentDetailLoading} error={studentError} token={token} onBack={returnToStudents} onSessionExpired={onSessionExpired} onNotify={notify} onSaved={handleStudentSaved} />}
        {view === 'teachers' && <TeacherDirectory page={teachers} loading={teachersLoading} error={teacherError} query={teacherQuery} onQueryChange={(value) => { setTeacherQuery(value); setTeacherPage(0) }} onAdd={openTeacherCreate} onOpen={openTeacherDetails} active={!showArchivedTeachers} onStatusChange={(active) => { setShowArchivedTeachers(!active); setTeacherPage(0) }} pageIndex={teacherPage} onPageChange={setTeacherPage} />}
        {view === 'teacherCreate' && <TeacherCreatePage token={token} onBack={returnToTeachers} onSessionExpired={onSessionExpired} onNotify={notify} onCreated={handleTeacherCreated} />}
        {view === 'teacherDetail' && <TeacherDetails teacher={teacherDetail} classrooms={classrooms} teacherChoices={teacherChoices} loading={teacherDetailLoading} error={teacherError} token={token} onBack={returnToTeachers} onSessionExpired={onSessionExpired} onNotify={notify} onSaved={handleTeacherSaved} onHomeroomChanged={handleHomeroomChanged} />}
        {view === 'parents' && <ParentDirectory parents={schoolParents.filter((parent) => parent.active !== showArchivedParents && `${parent.firstName} ${parent.lastName} ${parent.username} ${parent.email ?? ''} ${parent.children.join(' ')}`.toLowerCase().includes(parentQuery.trim().toLowerCase()))} query={parentQuery} onQueryChange={setParentQuery} onAdd={openParentCreate} onOpen={openParentDetails} active={!showArchivedParents} onStatusChange={(active) => setShowArchivedParents(!active)} loading={loading} />}
        {view === 'parentCreate' && <ParentCreatePage token={token} onBack={returnToParents} onSessionExpired={onSessionExpired} onNotify={notify} onCreated={handleParentCreated} />}
        {view === 'parentDetail' && <ParentDetails parent={parentDetail} parentChoices={schoolParents.filter((item) => item.active)} loading={parentDetailLoading} error={parentError} token={token} onBack={returnToParents} onSessionExpired={onSessionExpired} onNotify={notify} onSaved={handleParentSaved} />}
        {view === 'classrooms' && <section className="management-section-card management-directory-card management-classroom-directory"><div className="management-section-heading"><div><p className="management-eyebrow">LEARNING SPACES</p><h2>Classroom directory</h2></div><button className="management-student-add-button" type="button" onClick={openClassroomCreate}><Icon name="plus" /> Add classroom</button></div><div className="management-table-tools management-classroom-tools"><label className="management-search management-classroom-search"><Icon name="search" /><input value={classroomQuery} onChange={(event) => { setClassroomQuery(event.target.value); setClassroomPage(0) }} placeholder="Search by grade or section" aria-label="Search classrooms by grade or section" /></label><label className="management-student-filter management-classroom-filter"><span>GRADE</span><select aria-label="Filter classrooms by grade" value={classroomGradeFilter} onChange={(event) => { setClassroomGradeFilter(event.target.value); setClassroomPage(0) }}><option value="all">All grades</option>{Array.from(new Set(classrooms.map((room) => room.gradeLevel))).sort((a, b) => a - b).map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label><span className="management-count-chip">{filteredClassrooms.length} classroom{filteredClassrooms.length === 1 ? '' : 's'}</span></div>{loading ? <div className="management-empty">Loading classrooms…</div> : filteredClassrooms.length ? <><ClassroomList rooms={visibleClassrooms} detailed onOpen={openClassroomDetails} teacherChoices={classroomTeacherChoices} /><div className="management-pagination management-classroom-pagination"><span>{filteredClassrooms.length} learning space{filteredClassrooms.length === 1 ? '' : 's'}</span><div><button type="button" disabled={classroomPage <= 0} onClick={() => setClassroomPage((page) => Math.max(0, page - 1))}>← Previous</button><span>Page {classroomTotalPages ? classroomPage + 1 : 0} of {classroomTotalPages}</span><button type="button" disabled={classroomPage + 1 >= classroomTotalPages} onClick={() => setClassroomPage((page) => page + 1)}>Next →</button></div></div></> : <div className="management-empty">{classrooms.length ? 'No classrooms match those filters.' : 'No classrooms have been added yet.'}</div>}</section>}
        {view === 'classroomCreate' && <ClassroomCreatePage token={token} teachers={classroomTeacherChoices} teachersLoading={classroomTeacherChoicesLoading} onBack={returnToClassrooms} onSessionExpired={onSessionExpired} onNotify={notify} onCreated={handleClassroomCreated} />}
        {view === 'classroomDetail' && <ClassroomDetails classroom={classroomDetail} students={classroomRoster} teachers={classroomTeacherChoices} loading={classroomDetailLoading} rosterLoading={classroomRosterLoading} teachersLoading={classroomTeacherChoicesLoading} error={classroomError} rosterError={classroomRosterError} token={token} rosterPage={classroomRosterPage} onRosterPageChange={setClassroomRosterPage} onBack={returnToClassrooms} onSessionExpired={onSessionExpired} onNotify={notify} onSaved={handleClassroomSaved} />}
        {view === 'announcements' && <section className="management-section-card management-directory-card management-announcement-directory"><div className="management-section-heading"><div className="management-announcement-heading-group"><div><p className="management-eyebrow">SCHOOL NOTICEBOARD</p><h2>All announcements</h2></div><div className="management-announcement-mascot" tabIndex={0} role="img" aria-label="ClassBridge mascot holding a megaphone" title="Hover to hear the latest news"><img className="management-announcement-pose-rest" src="/images/beaver-announcement-rest.png" alt="" /><img className="management-announcement-pose-hover" src="/images/beaver-announcement-cutout.png" alt="" aria-hidden="true" /><span>Fresh from the noticeboard</span></div></div><button className="management-student-add-button" type="button" onClick={openAnnouncementCreate}><Icon name="plus" /> New announcement</button></div><div className="management-table-tools management-announcement-tools"><label className="management-search management-announcement-search"><Icon name="search" /><input value={announcementQuery} onChange={(event) => { setAnnouncementQuery(event.target.value); setAnnouncementPage(0) }} placeholder="Search title, message, or author" aria-label="Search announcements" /></label><label className="management-student-filter"><span>ANNOUNCEMENT TYPE</span><select aria-label="Filter announcements by type" value={announcementTypeFilter} onChange={(event) => { setAnnouncementTypeFilter(event.target.value); setAnnouncementPage(0) }}><option value="all">All types</option>{Object.entries(announcementLabel).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label className="management-student-filter management-announcement-class-filter"><span>CLASSROOM</span><select aria-label="Filter announcements by classroom" value={announcementClassroomFilter} onChange={(event) => { setAnnouncementClassroomFilter(event.target.value); setAnnouncementPage(0) }}><option value="all">All classrooms</option>{classrooms.map((room) => <option key={room.id} value={room.id}>Grade {room.gradeLevel} · {room.sectionName}</option>)}</select></label><span className="management-count-chip">{filteredAnnouncements.length} announcement{filteredAnnouncements.length === 1 ? '' : 's'}</span></div>{loading ? <div className="management-empty">Loading announcements…</div> : visibleAnnouncements.length ? <><AnnouncementList items={visibleAnnouncements} onOpen={openAnnouncementDetails} onDelete={(item) => setAnnouncementDeleteTarget(item)} /><div className="management-pagination management-announcement-pagination"><span>{filteredAnnouncements.length} school update{filteredAnnouncements.length === 1 ? '' : 's'}</span><div><button type="button" disabled={announcementPage <= 0} onClick={() => setAnnouncementPage((page) => Math.max(0, page - 1))}>← Previous</button><span>Page {announcementTotalPages ? announcementPage + 1 : 0} of {announcementTotalPages}</span><button type="button" disabled={announcementPage + 1 >= announcementTotalPages} onClick={() => setAnnouncementPage((page) => page + 1)}>Next →</button></div></div></> : <div className="management-empty">{announcements.length ? 'No announcements match those filters.' : 'No announcements have been shared yet.'}</div>}</section>}
        {view === 'announcementCreate' && <AnnouncementCreatePage classrooms={classrooms} token={token} onBack={returnToAnnouncements} onSessionExpired={onSessionExpired} onNotify={notify} onCreated={handleAnnouncementCreated} />}
        {view === 'announcementDetail' && <AnnouncementDetailsPage announcement={announcementDetail} loading={announcementDetailLoading} error={announcementError} token={token} onBack={returnToAnnouncements} onDelete={(item) => setAnnouncementDeleteTarget(item)} onSessionExpired={onSessionExpired} onNotify={notify} />}
        {view === 'messages' && <section className="management-message-page">
          <div className="management-message-heading"><div><p className="management-eyebrow">SCHOOL CONVERSATIONS</p><h2>Your inbox</h2><p>Private conversations with people in your school community.</p></div><div className="management-message-heading-actions"><span className="management-count-chip">{unreadMessageCount} unread</span><button className="management-primary-button" type="button" onClick={openMessageCompose}><Icon name="plus" /> New message</button></div></div>
          <div className={'management-message-layout' + (selectedConversationId !== null ? ' has-selection' : '')}>
            <aside className="management-message-list-panel" aria-label="Your conversations"><div className="management-message-list-heading"><div><p className="management-eyebrow">YOUR CONVERSATIONS</p><strong>{conversations.length} conversation{conversations.length === 1 ? '' : 's'}</strong></div></div>
              {conversationsLoading ? <div className="management-empty">Loading your inbox…</div> : conversationsError ? <div className="management-message-error"><p>Your conversations could not be loaded.</p><button className="management-secondary-button" type="button" onClick={() => { conversationsLoaded.current = false; setReloadKey((key) => key + 1) }}>Try again</button></div> : conversations.length ? <nav className="management-message-list" aria-label="Conversations">{conversations.map((item) => <button className={'management-message-list-item' + (item.id === selectedConversationId ? ' is-selected' : '')} key={item.id} type="button" onClick={() => openConversation(item.id)} aria-current={item.id === selectedConversationId ? 'page' : undefined}><ManagementMessageAvatar appearance={item.otherParticipantAppearance} name={item.otherParticipantDisplayName} /><span className="management-message-list-copy"><strong>{item.otherParticipantDisplayName}</strong><small>{item.studentDisplayName ? `About ${item.studentDisplayName}` : item.otherParticipantRole.replaceAll('_', ' ')}</small><span>{item.latestMessage || 'Open conversation'}</span></span><span className="management-message-list-meta"><time>{formatDate(item.lastMessageAt)}</time>{item.unreadCount > 0 && <i>{item.unreadCount}</i>}</span></button>)}</nav> : <div className="management-empty">No conversations yet. Start a private message to someone in your school.</div>}
            </aside>
            <section className="management-message-thread-panel" aria-label="Selected conversation">
              {selectedConversation ? <>
                <header className="management-message-thread-heading"><ManagementMessageAvatar appearance={selectedConversation.otherParticipantAppearance} name={selectedConversation.otherParticipantDisplayName} /><div><p className="management-eyebrow">SCHOOL CONVERSATION</p><h3>{selectedConversation.otherParticipantDisplayName}</h3><span>{selectedConversation.studentDisplayName ? `About ${selectedConversation.studentDisplayName} · ` : ''}{selectedConversation.otherParticipantRole.replaceAll('_', ' ')}</span></div></header>
                {threadError && <div className="management-message-error" role="alert"><p>{threadError}</p><button className="management-secondary-button" type="button" onClick={() => { detailsCache.current.delete(selectedConversation.id); setReloadKey((key) => key + 1) }}>Try again</button></div>}
                {threadLoading ? <div className="management-empty">Opening conversation…</div> : conversationDetail?.conversation.id === selectedConversation.id ? <>
                  <div className="management-message-thread" ref={messageThreadRef} aria-live="polite">{conversationDetail.messages.length ? conversationDetail.messages.map((message) => { const ownMessage = message.senderAccountId === profile.userAccountId; return <article className={'management-message-bubble' + (ownMessage ? ' is-own' : '')} key={message.id}><div className="management-message-bubble-meta"><strong>{ownMessage ? 'You' : message.senderDisplayName}</strong><time>{formatDate(message.createdAt)}</time></div><p>{message.message}</p>{message.attachments.length > 0 && <div className="management-message-attachments">{message.attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => void downloadMessageAttachment(conversationDetail.conversation.id, message.id, attachment)}><span aria-hidden="true">↧</span>{attachment.displayFilename}<small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small></button>)}</div>}</article> }) : <div className="management-empty">There are no messages in this conversation yet.</div>}</div>
                  {conversationDetail.conversation.readOnly ? <p className="management-message-readonly">This conversation is read-only.</p> : <form className="management-message-reply" onSubmit={(event) => void sendMessage(event)}><label className="sr-only" htmlFor="management-message-draft">Your message</label><textarea id="management-message-draft" maxLength={5000} rows={3} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Write a reply…" /><div><small>{messageDraft.length}/5000</small><button className="management-primary-button" type="submit" disabled={sendingMessage || !messageDraft.trim()}>{sendingMessage ? 'Sending…' : 'Send message'} <Icon name="arrow" /></button></div></form>}
                </> : <div className="management-empty">Choose a conversation to read and reply.</div>}
              </> : <div className="management-message-no-selection"><span aria-hidden="true">✉</span><p className="management-eyebrow">A NOTE FROM YOUR SCHOOL</p><h3>Your conversations will appear here.</h3><p>Choose a name from your inbox or start a new private message.</p><button className="management-secondary-button" type="button" onClick={openMessageCompose}>Write a message</button></div>}
            </section>
          </div>
        </section>}
        {view === 'messageCompose' && <section className="management-message-compose-page"><button className="management-back-link" type="button" onClick={() => selectView('messages')}>← Back to inbox</button><div className="management-message-compose-layout"><aside className="management-message-compose-intro"><p className="management-eyebrow">SCHOOL COMMUNITY</p><h2>Write a private note.</h2><p>{isSuperadmin ? "Choose a school, find a recipient in its directory, and send a private message." : "Search for a person in your school, then send a message directly to them."}</p><div className="management-message-compose-note"><img src="/images/beaver-guide-cutout.png" alt="ClassBridge beaver mascot" /><span><strong>{isSuperadmin ? "One-to-one messaging across schools." : "One-to-one, school-safe messaging."}</strong><small>{isSuperadmin ? "Choose a school to search its permitted directory." : "Your school directory determines who can be contacted."}</small></span></div></aside><form className="management-section-card management-message-compose-form" onSubmit={(event) => void startConversation(event)}><div className="management-section-heading"><div><p className="management-eyebrow">RECIPIENT</p><h2>Choose one person</h2></div></div>
            {!selectedRecipient ? <>{isSuperadmin && <label className="management-form-field management-message-school-field"><span>School</span><select value={recipientSchoolId} onChange={(event) => { setRecipientSchoolId(event.target.value); setRecipientQuery(''); setRecipients([]); setRecipientsError('') }}><option value="">Choose a school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>}<label className="management-search management-message-recipient-search"><Icon name="search" /><input type="search" autoComplete="off" disabled={isSuperadmin && !recipientSchoolId} value={recipientQuery} onChange={(event) => { setRecipientQuery(event.target.value); setRecipientsError('') }} placeholder="Search by name, username, or school number" aria-label={isSuperadmin ? "Search people in the selected school" : "Search people in your school"} /></label><p className="management-message-recipient-hint">{isSuperadmin && !recipientSchoolId ? "Choose a school before searching its directory." : "Enter at least two characters to search the directory."}</p>{recipientsLoading && <div className="management-empty">{isSuperadmin ? "Searching the selected school…" : "Searching your school…"}</div>}{recipientsError && <p className="management-inline-error" role="alert">{recipientsError}</p>}{!recipientsLoading && recipientQuery.trim().length >= 2 && !recipientsError && (!isSuperadmin || recipientSchoolId) && <div className="management-message-recipient-results">{recipients.length ? recipients.map((recipient) => <button type="button" key={`${recipient.accountId}-${recipient.studentProfileId ?? 'school'}`} onClick={() => setSelectedRecipient(recipient)}><span className="management-message-avatar">{initials(recipient.displayName)}</span><span><strong>{recipient.displayName}</strong><small>{recipient.role.replaceAll('_', ' ')}{recipient.schoolNumber ? ` · No. ${recipient.schoolNumber}` : ''}</small></span><i aria-hidden="true">＋</i></button>) : <div className="management-empty">No matching people were found in {isSuperadmin ? "this school" : "your school"}.</div>}</div>}</> : <div className="management-message-recipient-selected"><span className="management-message-avatar">{initials(selectedRecipient.displayName)}</span><span><strong>{selectedRecipient.displayName}</strong><small>{selectedRecipient.role.replaceAll('_', ' ')}{selectedRecipient.schoolNumber ? ` · No. ${selectedRecipient.schoolNumber}` : ''}</small></span><button className="management-text-button" type="button" onClick={() => { setSelectedRecipient(null); setNewMessageDraft('') }}>Change</button></div>}
            <label className="management-form-field management-message-body-field"><span>Message</span><textarea maxLength={5000} rows={6} value={newMessageDraft} onChange={(event) => setNewMessageDraft(event.target.value)} placeholder={selectedRecipient ? `Write a private message to ${selectedRecipient.displayName}…` : 'Choose a recipient first'} disabled={!selectedRecipient} required /><small>{newMessageDraft.length}/5000</small></label><div className="management-message-compose-actions"><button className="management-secondary-button" type="button" onClick={() => selectView('messages')}>Cancel</button><button className="management-primary-button" type="submit" disabled={sendingNewMessage || !selectedRecipient || !newMessageDraft.trim()}>{sendingNewMessage ? 'Sending…' : 'Send message'} <Icon name="arrow" /></button></div>
          </form></div></section>}
        {view === 'schools' && isSuperadmin && <section className="management-section-card management-directory-card"><div className="management-section-heading"><div><p className="management-eyebrow">PLATFORM MANAGEMENT</p><h2>School directory</h2></div><span className="management-count-chip">{schools.length} schools</span></div>{loading ? <div className="management-empty">Loading schools…</div> : schools.length ? <SchoolList schools={schools} detailed /> : <div className="management-empty">No schools have been created yet.</div>}</section>}
        {view === 'profile' && <section className="management-profile-page"><div className="management-profile-layout"><div className="management-profile-main-column">
          <section className="management-section-card management-profile-panel"><div className="management-section-heading"><div><p className="management-eyebrow">ACCOUNT DETAILS</p><h2>Your information</h2></div><span className="management-count-chip">{isSuperadmin ? "Platform managed" : "School managed"}</span></div><div className="management-profile-account-grid"><div><small>FULL NAME</small><strong>{fullName}</strong></div><div><small>USERNAME</small><strong>{profile.username}</strong></div><div><small>ROLE</small><strong>{profile.role.replaceAll('_', ' ')}</strong></div>{profile.schoolName && <div><small>SCHOOL</small><strong>{profile.schoolName}</strong></div>}</div><p className="management-profile-note">{isSuperadmin ? "Your name, username, and role are managed by ClassBridge" : "Your name, username, and role are managed by your school"} and can’t be changed here.</p></section>
          <section className="management-section-card management-profile-panel"><div className="management-section-heading"><div><p className="management-eyebrow">CONTACT DETAILS</p><h2>Ways to reach you</h2></div></div>
            <form className="management-profile-field-form" onSubmit={(event) => void saveEmail(event)}><label htmlFor="management-profile-email">Email address <span className={'management-email-status' + (emailVerified && emailDraft.trim() === savedEmail ? ' is-verified' : '')}>{emailVerified && emailDraft.trim() === savedEmail ? 'Verified' : 'Not verified'}</span></label><div className="management-profile-inline-field"><input id="management-profile-email" type="email" autoComplete="email" maxLength={254} value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="you@example.com" required /><button className="management-primary-button" type="submit" disabled={profileSaving || !emailDraft.trim() || emailDraft.trim() === savedEmail}>{profileSaving ? 'Saving…' : 'Save email'}</button></div></form>
            {emailDraft.trim() && (!emailVerified || emailDraft.trim() !== savedEmail) && <div className="management-profile-verification"><button className="management-text-button" type="button" disabled={profileSaving || emailDraft.trim() !== savedEmail} onClick={() => void requestEmailVerification()}>{verificationSent ? 'Send a new code' : 'Send verification code'} →</button>{verificationSent && <form className="management-profile-inline-field management-profile-code-form" onSubmit={(event) => void confirmEmailVerification(event)}><label className="sr-only" htmlFor="management-email-code">Six-digit verification code</label><input id="management-email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" /><button className="management-secondary-button" type="submit" disabled={profileSaving || verificationCode.length !== 6}>{profileSaving ? 'Checking…' : 'Verify email'}</button></form>}</div>}
            <form className="management-profile-field-form" onSubmit={(event) => void savePhone(event)}><label htmlFor="management-profile-phone">Phone number</label><div className="management-profile-inline-field"><input id="management-profile-phone" type="tel" autoComplete="tel" maxLength={32} value={phoneDraft} onChange={(event) => setPhoneDraft(event.target.value)} placeholder="Add your phone number" /><button className="management-primary-button" type="submit" disabled={profileSaving || !phoneDraft.trim() || phoneDraft.trim() === savedPhone}>{profileSaving ? 'Saving…' : 'Save number'}</button></div></form>
          </section>
          <section className="management-section-card management-profile-panel"><div className="management-section-heading"><div><p className="management-eyebrow">SECURITY</p><h2>Change your password</h2></div></div><form className="management-password-form" onSubmit={(event) => void changePassword(event)}><div className="management-password-grid"><label className="management-form-field">Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="management-form-field">New password<input type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label className="management-form-field">Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label></div><div className="management-password-actions"><small>Use 8 to 20 characters. Your current password is required.</small><button className="management-primary-button" type="submit" disabled={passwordSaving || !currentPassword || !newPassword || !passwordConfirmation || newPassword !== passwordConfirmation}>{passwordSaving ? 'Updating…' : 'Update password'}</button></div></form></section>
        </div><aside className="management-profile-side-column"><section className="management-section-card management-profile-panel management-avatar-panel"><div className="management-section-heading"><div><p className="management-eyebrow">YOUR PORTRAIT</p><h2>Choose an avatar</h2></div></div><div className="management-avatar-preview"><span className="management-avatar-preview-image">{appearanceDraft.avatarType === 'PHOTO' && appearanceDraft.imageDataUrl ? <img src={appearanceDraft.imageDataUrl} alt="Your selected profile portrait" /> : appearanceDraft.avatarType === 'ANIMAL' && selectedAppearanceAnimal ? <span style={profileAnimalArt(selectedAppearanceAnimal)} /> : initials(fullName)}</span><span><strong>{appearanceDraft.avatarType === 'PHOTO' ? 'Your photo' : appearanceDraft.avatarType === 'ANIMAL' && selectedAppearanceAnimal ? `${selectedAppearanceAnimal.name} · ${selectedAppearanceAnimal.group === 'adult' ? 'Adult' : 'Student'}` : 'Your initials'}</strong><small>Choose any portrait, for adults or students.</small></span></div>
            <div className="management-avatar-initial-choice"><button className={'management-avatar-choice' + (appearanceDraft.avatarType === 'INITIALS' ? ' is-selected' : '')} type="button" aria-pressed={appearanceDraft.avatarType === 'INITIALS'} onClick={() => setAppearanceDraft({ avatarType: 'INITIALS', animal: null, imageDataUrl: null })}><span className="management-avatar-option-initials">{initials(fullName)}</span><strong>Initials</strong></button></div>
            <div className="management-avatar-groups" aria-label="Animal portraits">{(['adult', 'student'] as const).map((group) => <section className="management-avatar-group" key={group}><h3>{group === 'adult' ? 'For adults' : 'For students'}</h3><div className="management-avatar-options" role="group" aria-label={group === 'adult' ? 'Adult animal portraits' : 'Student animal portraits'}>{profileAnimalOptions.filter((animal) => animal.group === group).map((animal) => <button className={'management-avatar-choice' + (appearanceDraft.avatarType === 'ANIMAL' && appearanceDraft.animal === animal.id ? ' is-selected' : '')} key={animal.id} type="button" aria-label={`${animal.name} · ${group === 'adult' ? 'Adult' : 'Student'}`} aria-pressed={appearanceDraft.avatarType === 'ANIMAL' && appearanceDraft.animal === animal.id} title={`${animal.name} · ${group === 'adult' ? 'Adult' : 'Student'}`} onClick={() => setAppearanceDraft({ avatarType: 'ANIMAL', animal: animal.id, imageDataUrl: null })}><span className="management-avatar-option-animal" style={profileAnimalArt(animal)} /><strong>{animal.name}</strong></button>)}</div></section>)}</div>
            <label className="management-avatar-upload">＋ Upload a photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectProfilePhoto} /></label><small className="management-avatar-hint">JPG, PNG or WebP · up to 2 MB</small><button className="management-primary-button management-avatar-save" type="button" disabled={appearanceSaving || appearanceLoading || JSON.stringify(appearance) === JSON.stringify(appearanceDraft)} onClick={() => void saveAppearance()}>{appearanceSaving ? 'Saving…' : 'Save avatar'}</button>{appearanceLoading && <p className="management-avatar-loading">Loading your saved portrait…</p>}
          </section><section className="management-section-card management-profile-panel management-profile-shortcuts"><p className="management-eyebrow">QUICK ACCESS</p><button type="button" onClick={() => selectView('messages')}><span>Messages</span><small>{unreadMessageCount ? `${unreadMessageCount} unread` : 'Open your inbox'}</small><b>↗</b></button>{!isSuperadmin && <button type="button" onClick={() => selectView('announcements')}><span>School updates</span><small>Read recent announcements</small><b>↗</b></button>}<button className="management-profile-signout-link" type="button" onClick={onSignOut}><span>Sign out</span><small>End your administrator session</small><b>→</b></button></section></aside></div></section>}

        <footer className="management-footer"><span>CLASSBRIDGE</span><i /> Clear communication, closer communities <span className="management-footer-role">{profile.role.replaceAll('_', ' ')}</span></footer>
      </div>
      {previewForm && <PreviewDialog form={previewForm} record={previewRecord} classrooms={classrooms} onClose={closePreviewForm} onSubmit={() => setPreviewNotice('This is a design preview. The form is ready for review; no records have been saved.')} notice={previewNotice} />}
      {announcementDeleteTarget && <AnnouncementDeleteDialog announcement={announcementDeleteTarget} saving={announcementDeleteSaving} onCancel={() => { if (!announcementDeleteSaving) setAnnouncementDeleteTarget(null) }} onConfirm={() => void confirmAnnouncementDelete()} />}
      {showParentCreate && <ParentCreateDialog token={token} onClose={() => setShowParentCreate(false)} onSessionExpired={onSessionExpired} onNotify={notify} onCreated={handleParentCreated} />}
      {toast && <ManagementToast toast={toast} onDismiss={dismissToast} />}
    </section>
  </main>
}

function ClassroomCreatePage({ teachers, teachersLoading, token, onBack, onSessionExpired, onNotify, onCreated }: { teachers: TeacherProfile[]; teachersLoading: boolean; token: string; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onCreated: (classroom: Classroom) => void }) {
  const [gradeLevel, setGradeLevel] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [homeroomTeacherAccountId, setHomeroomTeacherAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const created = await postJson<Classroom>('/api/school-admin/classrooms', token, {
        gradeLevel: Number(gradeLevel),
        sectionName: sectionName.trim(),
        homeroomTeacherAccountId: homeroomTeacherAccountId ? Number(homeroomTeacherAccountId) : null,
      })
      onCreated(created)
      onNotify('success', `Grade ${created.gradeLevel} · ${created.sectionName} has been created.`)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setSaving(false) }
  }

  return <section className="management-student-create-page management-classroom-page">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to classrooms</button>
    <article className="management-section-card management-directory-card management-student-create-card">
      <div className="management-section-heading"><div><p className="management-eyebrow">LEARNING SPACES</p><h2>Classroom information</h2><p>Create a classroom for this school and optionally assign its homeroom teacher.</p></div></div>
        <form className="management-form management-student-record-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="management-form-grid"><label className="management-form-field"><span>Grade</span><select required value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} disabled={saving}><option value="" disabled>Select a grade</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label><label className="management-form-field"><span>Section</span><select required value={sectionName} onChange={(event) => setSectionName(event.target.value)} disabled={saving}><option value="" disabled>Select a section</option>{classroomSections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label><label className="management-form-field management-form-wide"><span>Homeroom teacher · optional</span><select value={homeroomTeacherAccountId} onChange={(event) => setHomeroomTeacherAccountId(event.target.value)} disabled={saving || teachersLoading}><option value="">Leave unassigned</option>{teachers.map((teacher) => <option key={teacher.userAccountId} value={teacher.userAccountId}>{teacher.firstName} {teacher.lastName} · {teacher.username}</option>)}</select></label></div>
        <div className="management-form-hint">The selected grade must match this school’s education level. You can leave the homeroom unassigned and set it later.</div>
        <div className="management-student-form-actions"><span>Classroom records belong to this school.</span><div className="management-classroom-form-buttons"><button className="management-secondary-button" type="button" onClick={onBack} disabled={saving}>Cancel</button><button className="management-student-create-submit" type="submit" disabled={saving || !gradeLevel || !sectionName.trim()} aria-busy={saving}>{saving ? 'Creating…' : 'Create classroom'} <Icon name="arrow" /></button></div></div>
      </form>
    </article>
  </section>
}

function ClassroomDetails({ classroom, students, teachers, loading, rosterLoading, teachersLoading, error, rosterError, token, rosterPage, onRosterPageChange, onBack, onSessionExpired, onNotify, onSaved }: { classroom: Classroom | null; students: StudentPage | null; teachers: TeacherProfile[]; loading: boolean; rosterLoading: boolean; teachersLoading: boolean; error: string; rosterError: string; token: string; rosterPage: number; onRosterPageChange: (update: (current: number) => number) => void; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onSaved: (classroom: Classroom) => void }) {
  const [gradeLevel, setGradeLevel] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [homeroomTeacherAccountId, setHomeroomTeacherAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!classroom) return
    setGradeLevel(String(classroom.gradeLevel))
    setSectionName(classroom.sectionName)
    setHomeroomTeacherAccountId(classroom.homeroomTeacherAccountId == null ? '' : String(classroom.homeroomTeacherAccountId))
  }, [classroom])

  const changed = Boolean(classroom && (gradeLevel !== String(classroom.gradeLevel) || sectionName.trim() !== classroom.sectionName || (homeroomTeacherAccountId ? Number(homeroomTeacherAccountId) : null) !== classroom.homeroomTeacherAccountId))
  const assignedTeacher = classroom?.homeroomTeacherAccountId == null ? null : teachers.find((teacher) => teacher.userAccountId === classroom.homeroomTeacherAccountId) ?? null
  const assignedTeacherIsUnavailable = Boolean(classroom?.homeroomTeacherAccountId != null && !assignedTeacher)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!classroom || !changed || saving || loading || error || !sectionName.trim()) return
    setSaving(true)
    try {
      const updated = await putJson<Classroom>(`/api/school-admin/classrooms/${classroom.id}`, token, {
        gradeLevel: Number(gradeLevel),
        sectionName: sectionName.trim(),
        homeroomTeacherAccountId: homeroomTeacherAccountId ? Number(homeroomTeacherAccountId) : null,
      })
      onSaved(updated)
      onNotify('success', `Grade ${updated.gradeLevel} · ${updated.sectionName} has been updated.`)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setSaving(false) }
  }

  if (loading && !classroom) return <section className="management-student-create-page management-classroom-page"><button className="management-student-back-link" type="button" onClick={onBack}>← Back to classrooms</button><div className="management-empty">Loading classroom details…</div></section>
  if (!classroom) return <section className="management-student-create-page management-classroom-page"><button className="management-student-back-link" type="button" onClick={onBack}>← Back to classrooms</button><div className="management-empty">{error || 'Classroom details are unavailable.'}</div></section>

  const studentsInRoom = students?.content ?? []
  const totalRosterPages = students?.totalPages ?? 0
  return <section className="management-student-detail management-classroom-page">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to classrooms</button>
    <article className="management-student-record management-classroom-record">
      <aside className="management-student-record-rail"><span>CLASSROOM<br />RECORD</span><strong>{String(classroom.id).padStart(2, '0')}</strong><i /><small>GRADE {classroom.gradeLevel}</small></aside>
      <div className="management-student-record-main">
        <header className="management-student-record-head"><span className="management-classroom-record-icon"><Icon name="classes" /></span><div><p className="management-eyebrow">LEARNING SPACES · PROFILE</p><h2>Grade {classroom.gradeLevel} · {classroom.sectionName}</h2><p className="management-student-record-meta"><span>School classroom</span></p></div></header>
        <div className="management-student-record-section"><p className="management-eyebrow">CLASSROOM DETAILS</p><span className="management-student-record-caption">Update the grade, section, or homeroom assignment</span></div>
        {error && <div className="management-form-hint">{error}</div>}
        <form className="management-form management-student-record-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="management-form-grid"><label className="management-form-field"><span>Grade</span><select required value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} disabled={saving || loading || Boolean(error)}><option value="" disabled>Select a grade</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label><label className="management-form-field"><span>Section</span><select required value={sectionName} onChange={(event) => setSectionName(event.target.value)} disabled={saving || loading || Boolean(error)}>{classroom && !classroomSections.includes(classroom.sectionName) && <option value={classroom.sectionName}>{classroom.sectionName}</option>}{classroomSections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label><label className="management-form-field management-form-wide"><span>Homeroom teacher</span><select value={homeroomTeacherAccountId} onChange={(event) => setHomeroomTeacherAccountId(event.target.value)} disabled={saving || loading || Boolean(error) || teachersLoading}><option value="">Unassigned</option>{assignedTeacherIsUnavailable && classroom?.homeroomTeacherAccountId != null && <option value={classroom.homeroomTeacherAccountId}>Current assignment unavailable · remove to reassign</option>}{teachers.map((teacher) => <option key={teacher.userAccountId} value={teacher.userAccountId}>{teacher.firstName} {teacher.lastName} · {teacher.username}</option>)}</select></label></div>
          <div className="management-student-account-strip management-classroom-account-strip"><div><small>CLASSROOM</small><strong>Grade {classroom.gradeLevel} · {classroom.sectionName}</strong></div><div><small>HOMEROOM TEACHER</small><strong>{assignedTeacher ? `${assignedTeacher.firstName} ${assignedTeacher.lastName}` : assignedTeacherIsUnavailable ? 'Current assignment unavailable' : 'Not assigned'}</strong></div><div><small>ACTIVE STUDENTS</small><strong>{rosterLoading ? 'Loading…' : (students?.totalElements ?? 0).toLocaleString('en')}</strong></div></div>
          <div className="management-student-form-actions"><span>Classroom changes apply to this school.</span><button className="management-student-save-button" type="submit" disabled={!changed || saving || loading || Boolean(error) || !sectionName.trim()} aria-busy={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>
    </article>
    <section className="management-section-card management-classroom-roster"><div className="management-section-heading"><div><p className="management-eyebrow">SCHOOL ROSTER</p><h2>Students in this classroom</h2></div><span className="management-count-chip">{rosterLoading ? 'Loading…' : `${(students?.totalElements ?? 0).toLocaleString('en')} students`}</span></div>{rosterLoading ? <div className="management-empty">Loading the classroom roster…</div> : rosterError && !students ? <div className="management-empty">{rosterError}</div> : studentsInRoom.length ? <div className="management-classroom-roster-list">{studentsInRoom.map((student) => <article className="management-classroom-roster-row" key={student.id}><span className="management-table-avatar">{initials(`${student.firstName} ${student.lastName}`)}</span><span><strong>{student.firstName} {student.lastName}</strong><small>{student.studentUsername || 'Parent access'} · {student.schoolNumber}</small></span><span className={'management-student-status' + (student.active ? ' is-active' : '')}><i />{student.active ? 'Active' : 'Archived'}</span></article>)}</div> : <div className="management-empty">No active students are assigned to this classroom.</div>}{students && students.totalPages > 1 && <div className="management-pagination management-student-pagination"><span>{students.totalElements.toLocaleString('en')} students</span><div><button type="button" disabled={rosterPage <= 0} onClick={() => onRosterPageChange((page) => Math.max(0, page - 1))}>← Previous</button><span>Page {rosterPage + 1} of {totalRosterPages}</span><button type="button" disabled={rosterPage + 1 >= totalRosterPages} onClick={() => onRosterPageChange((page) => page + 1)}>Next →</button></div></div>}</section>
  </section>
}

function StudentDetails({ student, classrooms, loading, error, token, onBack, onSessionExpired, onNotify, onSaved }: { student: StudentProfile | null; classrooms: Classroom[]; loading: boolean; error: string; token: string; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onSaved: (student: StudentProfile) => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [schoolNumber, setSchoolNumber] = useState('')
  const [classroomId, setClassroomId] = useState('')
  const [saving, setSaving] = useState(false)
  const [accountActionBusy, setAccountActionBusy] = useState(false)
  const [statusAction, setStatusAction] = useState<'archive' | 'restore' | null>(null)
  const [resetCredentials, setResetCredentials] = useState<AdminPasswordReset | null>(null)
  const initializedStudentId = useRef<number | null>(null)

  useEffect(() => {
    if (!student || initializedStudentId.current === student.id) return
    initializedStudentId.current = student.id
    setFirstName(student.firstName)
    setLastName(student.lastName)
    setSchoolNumber(student.schoolNumber)
    setClassroomId(String(student.classroomId))
    setResetCredentials(null)
  }, [student])

  useEffect(() => {
    if (!statusAction) return
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !accountActionBusy) setStatusAction(null)
    }
    document.addEventListener('keydown', dismissOnEscape)
    return () => document.removeEventListener('keydown', dismissOnEscape)
  }, [accountActionBusy, statusAction])

  const changed = Boolean(student && (firstName !== student.firstName || lastName !== student.lastName || schoolNumber !== student.schoolNumber || classroomId !== String(student.classroomId)))
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!student || !changed || !student.active) return
    setSaving(true)
    try {
      const updated = await putJson<StudentProfile>(`/api/school-admin/students/${student.id}`, token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        schoolNumber: schoolNumber.trim(),
        classroomId: Number(classroomId),
      })
      onSaved(updated)
      onNotify('success', 'Student details saved.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally {
      setSaving(false)
    }
  }

  const confirmStatusAction = async () => {
    if (!student || !statusAction || accountActionBusy) return
    const action = statusAction
    setAccountActionBusy(true)
    try {
      const updated = await postJson<StudentProfile>(`/api/school-admin/students/${student.id}/${action}`, token, {})
      onSaved(updated)
      onNotify('success', action === 'archive'
        ? 'Student archived. The record is retained in the archived directory.'
        : 'Student restored. The profile is active again.')
      setStatusAction(null)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally {
      setAccountActionBusy(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!student?.studentUserAccountId || !student.active || (Boolean(student.studentEmail?.trim()) && student.studentEmailVerified) || accountActionBusy) return
    setAccountActionBusy(true)
    setResetCredentials(null)
    try {
      const result = await postJson<AdminPasswordReset>(`/api/school-admin/accounts/${student.studentUserAccountId}/password-reset`, token, {})
      setResetCredentials(result)
      onSaved({ ...student, mustChangePassword: true })
      onNotify('success', 'A temporary password was generated. Share it securely with the student.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally {
      setAccountActionBusy(false)
    }
  }

  return <section className="management-student-detail">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to students</button>
    {loading ? <div className="management-empty">Loading student details…</div> : error ? <div className="management-empty">Student details are unavailable. Return to the directory to try again.</div> : student && <article className="management-student-record">
      <aside className="management-student-record-rail"><span>STUDENT<br />RECORD</span><strong>{String(student.id).padStart(2, '0')}</strong><i /><small>GRADE {student.gradeLevel}</small></aside>
      <div className="management-student-record-main">
        <header className="management-student-record-head"><span className="management-table-avatar">{initials(`${student.firstName} ${student.lastName}`)}</span><div><p className="management-eyebrow">SCHOOL ROSTER · PROFILE</p><h2>{student.firstName} {student.lastName}</h2><p className="management-student-record-meta"><span>Grade {student.gradeLevel} · {student.sectionName}</span><span className={'management-student-status' + (student.active ? ' is-active' : '')}><i />{student.active ? 'Active' : 'Archived'}</span></p></div></header>
        <div className="management-student-record-section"><p className="management-eyebrow">ENROLLMENT DETAILS</p><span className="management-student-record-caption">School information for this student</span></div>
        {!student.active && <div className="management-form-hint">This profile is archived, so its school details are read-only.</div>}
        {resetCredentials && <section className="management-student-credentials management-student-reset-credentials" aria-live="polite"><p className="management-eyebrow">TEMPORARY SIGN-IN</p><div><small>USERNAME</small><strong>{resetCredentials.username}</strong></div><div><small>TEMPORARY PASSWORD</small><strong>{resetCredentials.temporaryPassword}</strong></div><p>The student must replace this password before accessing the workspace. This password is shown only in this response.</p></section>}
        <form className="management-form management-student-record-form" onSubmit={handleSubmit}>
          <div className="management-form-grid"><label className="management-form-field"><span>First name</span><input required maxLength={100} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={!student.active || saving} /></label><label className="management-form-field"><span>Last name</span><input required maxLength={100} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={!student.active || saving} /></label><label className="management-form-field"><span>School number</span><input required maxLength={50} value={schoolNumber} onChange={(event) => setSchoolNumber(event.target.value)} disabled={!student.active || saving} /></label><label className="management-form-field"><span>Classroom</span><select required value={classroomId} onChange={(event) => setClassroomId(event.target.value)} disabled={!student.active || saving}><option value="" disabled>Select a classroom</option>{classrooms.map((room) => <option key={room.id} value={room.id}>Grade {room.gradeLevel} · {room.sectionName}</option>)}</select></label></div>
          <div className="management-student-account-strip"><div><small>STUDENT USERNAME</small><strong>{student.studentUsername || 'No student login account'}</strong></div><div><small>EMAIL ADDRESS</small><strong>{student.studentEmail || 'Not provided'}{student.studentEmail && <em className={student.studentEmailVerified ? 'is-verified' : 'is-unverified'}>{student.studentEmailVerified ? 'Verified' : 'Not verified'}</em>}</strong></div><div><small>PHONE NUMBER</small><strong>{student.studentPhoneNumber || 'Not provided'}</strong></div><div><small>LINKED PARENT</small><strong>{student.parentUsername ? `${student.parentFirstName ? `${student.parentFirstName} ${student.parentLastName} · ` : ''}${student.parentUsername}` : 'No parent account linked'}</strong></div><div><small>PROFILE ADDED</small><strong>{formatDate(student.createdAt)}</strong></div></div>
          {student.mustChangePassword && student.active && <div className="management-form-hint">A temporary password is active. The student must choose a new password before continuing.</div>}
          <div className="management-student-form-actions"><span>{student.active ? 'Only this school profile is changed here.' : 'Archived student records are read-only.'}</span><div className="management-student-action-buttons">{student.active && student.studentUserAccountId && (!student.studentEmail?.trim() || !student.studentEmailVerified) && <button className="management-student-secondary-action" type="button" onClick={() => void handlePasswordReset()} disabled={accountActionBusy}>{accountActionBusy ? 'Working…' : 'Reset password'}</button>}<button className={student.active ? 'management-student-archive-button' : 'management-student-secondary-action'} type="button" onClick={() => setStatusAction(student.active ? 'archive' : 'restore')} disabled={accountActionBusy}>{student.active ? 'Archive student' : 'Restore student'}</button><button className="management-student-save-button" type="submit" disabled={!student.active || !changed || saving || accountActionBusy}>{saving ? 'Saving…' : 'Save changes'}</button></div></div>
        </form>
      </div>
    </article>}
    {statusAction && student && <div className="management-modal-backdrop management-student-status-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !accountActionBusy) setStatusAction(null) }}>
      <section className="management-student-status-dialog" role="dialog" aria-modal="true" aria-labelledby="management-student-status-title" aria-describedby="management-student-status-description">
        <aside className="management-student-status-guide" aria-label="ClassBridge mascot">
          <p className="management-eyebrow">CLASSBRIDGE GUIDE</p>
          <div className="management-student-status-mascot"><img className="management-pose-rest" src="/images/beaver-guide-cutout.png" alt="" /><img className="management-pose-hover" src="/images/beaver-guide-wave.png" alt="" aria-hidden="true" /></div>
          <span className="management-student-status-bubble">One step at a time!</span>
        </aside>
        <div className="management-student-status-copy">
          <button className="management-modal-close management-student-status-close" type="button" onClick={() => setStatusAction(null)} disabled={accountActionBusy} aria-label="Close confirmation">×</button>
          <p className="management-eyebrow">STUDENT RECORD</p>
          <h2 id="management-student-status-title">{statusAction === 'archive' ? 'Archive this student?' : 'Restore this student?'}</h2>
          <p id="management-student-status-description">{statusAction === 'archive'
            ? `${student.firstName} ${student.lastName} will move to Archived and their student login will be disabled. The school record is kept and can be restored later.`
            : `${student.firstName} ${student.lastName} will return to Active. If they have a student account, sign-in access will be re-enabled.`}</p>
          <footer className="management-student-status-actions"><button className="management-secondary-button" type="button" onClick={() => setStatusAction(null)} disabled={accountActionBusy} autoFocus>{statusAction === 'archive' ? 'Keep active' : 'Not now'}</button><button className={statusAction === 'archive' ? 'management-danger-button' : 'management-primary-button'} type="button" onClick={() => void confirmStatusAction()} disabled={accountActionBusy}>{accountActionBusy ? 'Working…' : statusAction === 'archive' ? 'Archive student' : 'Restore student'}</button></footer>
        </div>
      </section>
    </div>}
  </section>
}

function TeacherDirectory({ page, loading, error, query, onQueryChange, onAdd, onOpen, active, onStatusChange, pageIndex, onPageChange }: { page: TeacherPage | null; loading: boolean; error: string; query: string; onQueryChange: (value: string) => void; onAdd: () => void; onOpen: (teacher: TeacherProfile) => void; active: boolean; onStatusChange: (active: boolean) => void; pageIndex: number; onPageChange: (update: (current: number) => number) => void }) {
  const teachers = page?.content ?? []
  return <section className="management-section-card management-directory-card management-teacher-directory">
    <div className="management-section-heading"><div className="management-student-heading-copy"><div><p className="management-eyebrow">SCHOOL TEAM</p><h2>{active ? 'Active teachers' : 'Archived teachers'}</h2></div>{active && <TeacherRosterMascots />}</div>{active && <button className="management-teacher-add-button" type="button" onClick={onAdd}><Icon name="plus" /> Add teacher</button>}</div>
    <div className="management-table-tools management-teacher-tools"><label className="management-search management-teacher-search"><Icon name="search" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search teachers by name, username, or email" aria-label="Search teachers by name, username, or email" /></label><div className="management-student-tabs" role="group" aria-label="Teacher account status"><button className={active ? 'is-selected' : ''} type="button" aria-pressed={active} onClick={() => onStatusChange(true)}>Active</button><button className={!active ? 'is-selected' : ''} type="button" aria-pressed={!active} onClick={() => onStatusChange(false)}>Archived</button></div></div>
    {loading ? <div className="management-empty">Loading teacher accounts…</div> : error ? <div className="management-empty">Teacher accounts could not be loaded.</div> : teachers.length ? <div className="management-table-wrap management-teacher-table-wrap"><table className="management-table"><thead><tr><th>TEACHER</th><th>USERNAME</th><th>HOMEROOM</th><th>STATUS</th><th /></tr></thead><tbody>{teachers.map((teacher) => <tr key={teacher.userAccountId}><td><span className="management-person-cell"><span className="management-table-avatar">{initials(`${teacher.firstName} ${teacher.lastName}`)}</span><span><strong>{teacher.firstName} {teacher.lastName}</strong><small>{teacher.email || teacher.phoneNumber || 'No contact details added'}</small></span></span></td><td>{teacher.username}</td><td>{teacher.homeroomClassrooms.length ? <span className="management-child-chips">{teacher.homeroomClassrooms.map((room) => <span className="management-class-chip" key={room.classroomId}>Grade {room.gradeLevel} · {room.sectionName}</span>)}</span> : <span className="management-table-muted">Not assigned</span>}</td><td><span className={'management-student-status' + (teacher.active ? ' is-active' : '')}><i />{teacher.active ? 'Active' : 'Archived'}</span></td><td><button className="management-teacher-detail-button" type="button" onClick={() => onOpen(teacher)} aria-label={`View ${teacher.firstName} ${teacher.lastName}`}>View record <Icon name="arrow" /></button></td></tr>)}</tbody></table></div> : <div className="management-empty">{query.trim() ? 'No teachers match this search.' : active ? 'No active teachers have been added yet.' : 'No archived teachers.'}</div>}
    {!loading && !error && page && <div className="management-pagination management-teacher-pagination"><span>{page.totalElements.toLocaleString('en')} teacher accounts</span><div><button type="button" disabled={pageIndex <= 0} onClick={() => onPageChange((current) => Math.max(0, current - 1))}>← Previous</button><span>Page {page.totalPages ? pageIndex + 1 : 0} of {page.totalPages}</span><button type="button" disabled={pageIndex + 1 >= page.totalPages} onClick={() => onPageChange((current) => current + 1)}>Next →</button></div></div>}
  </section>
}

function TeacherCreatePage({ token, onBack, onSessionExpired, onNotify, onCreated }: { token: string; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<CreatedTeacher | null>(null)
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSaving(true)
    try {
      const result = await postJson<CreatedTeacher>('/api/school-admin/teachers', token, {
        firstName: String(data.get('firstName') ?? '').trim(),
        lastName: String(data.get('lastName') ?? '').trim(),
        branch: String(data.get('branch') ?? '').trim() || null,
        username: String(data.get('username') ?? '').trim(),
        email: String(data.get('email') ?? '').trim() || null,
        phoneNumber: String(data.get('phoneNumber') ?? '').trim() || null,
      })
      setCreated(result)
      onCreated()
      onNotify('success', 'Teacher account created successfully.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setSaving(false) }
  }
  return <section className="management-teacher-create-page">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to teachers</button>
    {created ? <section className="management-section-card management-directory-card management-teacher-created-card"><div className="management-section-heading"><div><p className="management-eyebrow">SCHOOL TEAM · COMPLETE</p><h2>Teacher account created</h2></div><span className="management-created-mark" aria-hidden="true">✓</span></div><div className="management-student-created-summary"><strong>{created.firstName} {created.lastName}</strong><span>Username · {created.username}</span>{created.branch && <span>Branch · {created.branch}</span>}{created.email && <span>Email · {created.email}</span>}</div><section className="management-student-credentials" aria-live="polite"><p className="management-eyebrow">FIRST SIGN-IN</p><div><small>USERNAME</small><strong>{created.username}</strong></div><div><small>TEMPORARY PASSWORD</small><strong>{created.initialPassword}</strong></div><p>Share these details securely. The teacher will be asked to choose a new password before using the workspace.</p></section><div className="management-student-created-actions"><span>The account is now in your school directory.</span><button className="management-teacher-action-button" type="button" onClick={onBack}>Return to teachers <Icon name="arrow" /></button></div></section> : <section className="management-section-card management-directory-card management-teacher-create-card"><div className="management-section-heading"><div><p className="management-eyebrow">SCHOOL TEAM</p><h2>Teacher information</h2></div></div><form className="management-form management-teacher-create-form" onSubmit={(event) => void handleSubmit(event)}><div className="management-form-grid"><label className="management-form-field"><span>First name</span><input name="firstName" autoComplete="given-name" maxLength={100} placeholder="Teacher first name" required /></label><label className="management-form-field"><span>Last name</span><input name="lastName" autoComplete="family-name" maxLength={100} placeholder="Teacher last name" required /></label><label className="management-form-field"><span>Username</span><input name="username" autoComplete="username" maxLength={255} placeholder="Choose a unique username" required /></label><label className="management-form-field"><span>Branch · optional</span><select name="branch" defaultValue=""><option value="">Select a branch</option>{teacherBranchOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className="management-form-field"><span>Email address · optional</span><input name="email" type="email" autoComplete="email" maxLength={254} placeholder="name@school.edu" /></label><label className="management-form-field"><span>Phone number · optional</span><input name="phoneNumber" type="tel" autoComplete="tel" maxLength={32} placeholder="Teacher phone number" /></label></div><div className="management-global-info management-teacher-signin-note"><span className="management-student-note-mascot is-static" aria-hidden="true"><img className="management-pose-rest" src="/images/beaver-guide-cutout.png" alt="" /></span><span className="management-student-note-copy"><strong>Initial sign-in details</strong><span>A temporary password will be generated and shown once. The teacher must change it before entering the workspace.</span></span></div><footer className="management-student-form-actions"><span>Teacher accounts belong to this school only.</span><button className="management-teacher-action-button" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create teacher account'} <Icon name="arrow" /></button></footer></form></section>}
  </section>
}

function TeacherDetails({ teacher, classrooms, teacherChoices, loading, error, token, onBack, onSessionExpired, onNotify, onSaved, onHomeroomChanged }: { teacher: TeacherProfile | null; classrooms: Classroom[]; teacherChoices: TeacherProfile[]; loading: boolean; error: string; token: string; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onSaved: (teacher: TeacherProfile) => void; onHomeroomChanged: (classroom: Classroom) => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [branch, setBranch] = useState('')
  const [assignmentIds, setAssignmentIds] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyClassroomId, setBusyClassroomId] = useState<number | null>(null)
  const [statusAction, setStatusAction] = useState<'archive' | 'restore' | null>(null)
  const [resetCredentials, setResetCredentials] = useState<AdminPasswordReset | null>(null)
  const initializedId = useRef<number | null>(null)

  useEffect(() => {
    if (!teacher || initializedId.current === teacher.userAccountId) return
    initializedId.current = teacher.userAccountId
    setFirstName(teacher.firstName)
    setLastName(teacher.lastName)
    setBranch(teacher.branch ?? '')
    setAssignmentIds(Object.fromEntries(teacher.homeroomClassrooms.map((room) => [room.classroomId, String(teacher.userAccountId)])))
    setResetCredentials(null)
  }, [teacher])

  useEffect(() => {
    if (!statusAction) return
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setStatusAction(null)
    }
    document.addEventListener('keydown', dismissOnEscape)
    return () => document.removeEventListener('keydown', dismissOnEscape)
  }, [busy, statusAction])

  const changed = Boolean(teacher && (firstName !== teacher.firstName || lastName !== teacher.lastName || branch !== (teacher.branch ?? '')))
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!teacher || !changed || !teacher.active || saving || busy || busyClassroomId !== null) return
    setSaving(true)
    try {
      const updated = await putJson<TeacherProfile>(`/api/school-admin/teachers/${teacher.userAccountId}`, token, { firstName: firstName.trim(), lastName: lastName.trim(), branch: branch.trim() || null })
      setFirstName(updated.firstName)
      setLastName(updated.lastName)
      setBranch(updated.branch ?? '')
      onSaved(updated)
      onNotify('success', 'Teacher details saved.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setSaving(false) }
  }

  const updateStatus = async () => {
    if (!teacher || !statusAction || busy || saving || busyClassroomId !== null) return
    const action = statusAction
    setBusy(true)
    try {
      const updated = await postJson<TeacherProfile>(`/api/school-admin/teachers/${teacher.userAccountId}/${action}`, token, {})
      onSaved(updated)
      setStatusAction(null)
      onNotify('success', action === 'archive' ? 'Teacher archived. Their account access has been disabled.' : 'Teacher restored. Their account access is active again.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setBusy(false) }
  }

  const resetPassword = async () => {
    if (!teacher?.active || busy || saving || busyClassroomId !== null || changed) return
    setBusy(true)
    setResetCredentials(null)
    try {
      const credentials = await postJson<AdminPasswordReset>(`/api/school-admin/accounts/${teacher.userAccountId}/password-reset`, token, {})
      setResetCredentials(credentials)
      onSaved({ ...teacher, mustChangePassword: true })
      onNotify('success', 'A temporary password was generated. Share it securely with the teacher.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setBusy(false) }
  }

  const saveHomeroom = async (classroomId: number) => {
    const classroom = classrooms.find((item) => item.id === classroomId)
    const selectedTeacherValue = assignmentIds[classroomId] ?? String(teacher?.userAccountId ?? '')
    const selectedTeacherId = selectedTeacherValue ? Number(selectedTeacherValue) : null
    if (!classroom || !teacher?.active || selectedTeacherId === classroom.homeroomTeacherAccountId || busyClassroomId !== null || saving || busy) return
    setBusyClassroomId(classroomId)
    try {
      const updated = await putJson<Classroom>(`/api/school-admin/classrooms/${classroom.id}`, token, { gradeLevel: classroom.gradeLevel, sectionName: classroom.sectionName, homeroomTeacherAccountId: selectedTeacherId })
      onHomeroomChanged(updated)
      onNotify('success', selectedTeacherId === null
        ? `Grade ${updated.gradeLevel} · ${updated.sectionName} is now unassigned.`
        : `Homeroom teacher changed for Grade ${updated.gradeLevel} · ${updated.sectionName}.`)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setBusyClassroomId(null) }
  }

  const canArchive = Boolean(teacher && teacher.homeroomClassrooms.length === 0)
  return <section className="management-student-detail management-teacher-detail">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to teachers</button>
    {loading ? <div className="management-empty">Loading teacher details…</div> : error ? <div className="management-empty">Teacher details are unavailable. Return to the directory to try again.</div> : teacher && <article className="management-student-record management-teacher-record">
      <aside className="management-student-record-rail"><span>TEACHER<br />RECORD</span><strong>{String(teacher.userAccountId).padStart(2, '0')}</strong><i /><small>SCHOOL TEAM</small></aside>
      <div className="management-student-record-main">
        <header className="management-student-record-head"><span className="management-table-avatar">{initials(`${teacher.firstName} ${teacher.lastName}`)}</span><div><p className="management-eyebrow">SCHOOL TEAM · PROFILE</p><h2>{teacher.firstName} {teacher.lastName}</h2><p className="management-student-record-meta"><span>{teacher.username}</span><span className={'management-student-status' + (teacher.active ? ' is-active' : '')}><i />{teacher.active ? 'Active' : 'Archived'}</span></p></div></header>
        <div className="management-student-record-section"><p className="management-eyebrow">ACCOUNT DETAILS</p><span className="management-student-record-caption">School information for this teacher</span></div>
        {!teacher.active && <div className="management-form-hint">This account is archived, so school profile details are read-only.</div>}
        {resetCredentials && <section className="management-student-credentials management-student-reset-credentials" aria-live="polite"><p className="management-eyebrow">TEMPORARY SIGN-IN</p><div><small>USERNAME</small><strong>{resetCredentials.username}</strong></div><div><small>TEMPORARY PASSWORD</small><strong>{resetCredentials.temporaryPassword}</strong></div><p>The teacher must replace this password before accessing the workspace. This password is shown only in this response.</p></section>}
        <form className="management-form management-student-record-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="management-form-grid"><label className="management-form-field"><span>First name</span><input required maxLength={100} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={!teacher.active || saving} /></label><label className="management-form-field"><span>Last name</span><input required maxLength={100} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={!teacher.active || saving} /></label><label className="management-form-field"><span>Branch · optional</span><select value={branch} onChange={(event) => setBranch(event.target.value)} disabled={!teacher.active || saving}><option value="">No branch selected</option>{branch && !teacherBranchOptions.includes(branch) && <option value={branch}>{branch}</option>}{teacherBranchOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><div className="management-teacher-contact-readonly"><span>Email address</span><strong>{teacher.email || 'Not provided'}</strong></div><div className="management-teacher-contact-readonly"><span>Phone number</span><strong>{teacher.phoneNumber || 'Not provided'}</strong></div></div>
          <div className="management-student-account-strip"><div><small>TEACHER USERNAME</small><strong>{teacher.username}</strong></div><div><small>EMAIL STATUS</small><strong>{teacher.email || 'Not provided'}{teacher.email && <em className={teacher.emailVerified ? 'is-verified' : 'is-unverified'}>{teacher.emailVerified ? 'Verified' : 'Not verified'}</em>}</strong></div><div><small>PHONE NUMBER</small><strong>{teacher.phoneNumber || 'Not provided'}</strong></div><div><small>ACCOUNT CREATED</small><strong>{formatDate(teacher.createdAt)}</strong></div></div>
          {teacher.mustChangePassword && teacher.active && <div className="management-form-hint">A temporary password is active. The teacher must choose a new password before continuing.</div>}
          <div className="management-teacher-form-actions"><span>{teacher.active ? 'Account changes apply to this school teacher.' : 'Archived accounts are read-only.'}</span><div className="management-student-action-buttons">{teacher.active && <button className="management-student-secondary-action" type="button" onClick={() => void resetPassword()} disabled={busy || saving || busyClassroomId !== null || changed} aria-busy={busy}>{busy ? 'Working…' : 'Reset password'}</button>}<button className={teacher.active ? 'management-student-archive-button' : 'management-student-secondary-action'} type="button" onClick={() => setStatusAction(teacher.active ? 'archive' : 'restore')} disabled={busy || saving || busyClassroomId !== null || (teacher.active && (!canArchive || changed))} aria-busy={busy} title={teacher.active && !canArchive ? 'Reassign homeroom classrooms first.' : teacher.active && changed ? 'Save or discard unsaved changes first.' : undefined}>{teacher.active ? 'Archive teacher' : 'Restore teacher'}</button><button className="management-student-save-button" type="submit" disabled={!teacher.active || !changed || saving || busy || busyClassroomId !== null} aria-busy={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></div>
          {teacher.active && !canArchive && <p className="management-teacher-archive-note">Reassign the homeroom classrooms below before archiving this teacher.</p>}
        </form>
        <section className="management-teacher-homerooms"><div className="management-student-record-section"><p className="management-eyebrow">HOMEROOM ASSIGNMENTS</p><span className="management-student-record-caption">Managed here to keep classroom assignments in one place</span></div>{teacher.homeroomClassrooms.length ? teacher.homeroomClassrooms.map((room) => { const classroom = classrooms.find((item) => item.id === room.classroomId); const selectedValue = assignmentIds[room.classroomId] ?? String(teacher.userAccountId); const selectedTeacherId = selectedValue ? Number(selectedValue) : null; return <div className="management-teacher-homeroom-row" key={room.classroomId}><strong>Grade {room.gradeLevel} · {room.sectionName}</strong><select aria-label={`Homeroom teacher for Grade ${room.gradeLevel} ${room.sectionName}`} value={selectedValue} onChange={(event) => setAssignmentIds((current) => ({ ...current, [room.classroomId]: event.target.value }))} disabled={!teacher.active || busy || saving || busyClassroomId !== null}><option value="">Unassigned</option><option value={teacher.userAccountId}>{teacher.firstName} {teacher.lastName}{teacher.active ? ' · Current' : ' · Archived'}</option>{teacherChoices.filter((choice) => choice.active && choice.userAccountId !== teacher.userAccountId).map((choice) => <option key={choice.userAccountId} value={choice.userAccountId}>{choice.firstName} {choice.lastName}</option>)}</select><button className="management-teacher-action-button" type="button" disabled={!classroom || !teacher.active || selectedTeacherId === classroom.homeroomTeacherAccountId || busyClassroomId !== null || busy || saving} aria-busy={busyClassroomId === room.classroomId} onClick={() => void saveHomeroom(room.classroomId)}>{busyClassroomId === room.classroomId ? 'Saving…' : 'Reassign'}</button></div> }) : <p className="management-table-muted">No homeroom classrooms are assigned to this teacher.</p>}</section>
      </div>
    </article>}
    {statusAction && teacher && <div className="management-modal-backdrop management-student-status-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setStatusAction(null) }}><section className="management-student-status-dialog" role="dialog" aria-modal="true" aria-labelledby="management-teacher-status-title" aria-describedby="management-teacher-status-description"><aside className="management-student-status-guide" aria-label="ClassBridge mascot"><p className="management-eyebrow">CLASSBRIDGE GUIDE</p><div className="management-student-status-mascot"><img className="management-pose-rest" src="/images/beaver-guide-cutout.png" alt="" /><img className="management-pose-hover" src="/images/beaver-guide-wave.png" alt="" aria-hidden="true" /></div><span className="management-student-status-bubble">One step at a time!</span></aside><div className="management-student-status-copy"><button className="management-modal-close management-student-status-close" type="button" onClick={() => setStatusAction(null)} disabled={busy} aria-label="Close confirmation">×</button><p className="management-eyebrow">TEACHER RECORD</p><h2 id="management-teacher-status-title">{statusAction === 'archive' ? 'Archive this teacher?' : 'Restore this teacher?'}</h2><p id="management-teacher-status-description">{statusAction === 'archive' ? `${teacher.firstName} ${teacher.lastName} will move to Archived and their sign-in access will be disabled. The school record can be restored later.` : `${teacher.firstName} ${teacher.lastName} will return to Active and be able to sign in again.`}</p><footer className="management-student-status-actions"><button className="management-secondary-button" type="button" onClick={() => setStatusAction(null)} disabled={busy} autoFocus>{statusAction === 'archive' ? 'Keep active' : 'Not now'}</button><button className={statusAction === 'archive' ? 'management-danger-button' : 'management-primary-button'} type="button" onClick={() => void updateStatus()} disabled={busy}>{busy ? 'Working…' : statusAction === 'archive' ? 'Archive teacher' : 'Restore teacher'}</button></footer></div></section></div>}
  </section>
}

function ParentDirectory({ parents, query, onQueryChange, onAdd, onOpen, active, onStatusChange, loading }: { parents: SchoolParent[]; query: string; onQueryChange: (value: string) => void; onAdd: () => void; onOpen: (parent: SchoolParent) => void; active: boolean; onStatusChange: (active: boolean) => void; loading: boolean }) {
  return <section className="management-section-card management-directory-card management-parent-directory">
    <div className="management-section-heading"><div className="management-student-heading-copy"><div><p className="management-eyebrow">FAMILY CONNECTIONS</p><h2>{active ? 'Active parent accounts' : 'Archived parent accounts'}</h2></div>{active && <ParentRosterMascots />}</div>{active && <button className="management-parent-add-button" type="button" onClick={onAdd}><Icon name="plus" /> Add parent account</button>}</div>
    <p className="management-directory-intro">Create a family account for this school. It does not link any student by itself; select the parent from this school’s directory when enrolling or editing a student.</p>
    <div className="management-table-tools management-parent-tools"><label className="management-search management-parent-search"><Icon name="search" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search by name, username, email, or student" aria-label="Search parent accounts" /></label><div className="management-student-tabs" role="group" aria-label="Parent account status"><button className={active ? 'is-selected' : ''} type="button" aria-pressed={active} onClick={() => onStatusChange(true)}>Active</button><button className={!active ? 'is-selected' : ''} type="button" aria-pressed={!active} onClick={() => onStatusChange(false)}>Archived</button></div><span className="management-count-chip">{parents.length} account{parents.length === 1 ? '' : 's'}</span></div>
    {loading ? <div className="management-empty">Loading parent accounts…</div> : parents.length ? <div className="management-table-wrap"><table className="management-table management-parent-table"><thead><tr><th>PARENT ACCOUNT</th><th>USERNAME</th><th>CHILDREN IN THIS SCHOOL</th><th>STATUS</th><th /></tr></thead><tbody>{parents.map((parent) => <tr key={parent.parentProfileId}><td><span className="management-person-cell"><span className="management-table-avatar parent">{initials(`${parent.firstName} ${parent.lastName}`)}</span><span><strong>{parent.firstName} {parent.lastName}</strong><small>{parent.email || parent.phoneNumber || 'No contact details added'}</small></span></span></td><td>{parent.username}</td><td>{parent.children.length ? <span className="management-child-chips">{parent.children.map((child) => <span className="management-class-chip" key={child}>{child}</span>)}</span> : <span className="management-table-muted">No linked students yet</span>}</td><td><span className={'management-student-status' + (parent.active ? ' is-active' : '')}><i />{parent.active ? 'Active' : 'Archived'}</span></td><td><button className="management-parent-detail-button" type="button" onClick={() => onOpen(parent)} aria-label={`Open details for ${parent.firstName} ${parent.lastName}`}>View record <Icon name="arrow" /></button></td></tr>)}</tbody></table></div> : <div className="management-empty">No parent accounts match this search.</div>}
  </section>
}

function ParentCreatePage({ token, onBack, onSessionExpired, onNotify, onCreated }: { token: string; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onCreated: (parent: CreatedParent | SchoolParent) => void }) {
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<CreatedParent | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSaving(true)
    try {
      const parent = await postJson<CreatedParent>('/api/school-admin/parents', token, {
        firstName: String(data.get('firstName') ?? '').trim(),
        lastName: String(data.get('lastName') ?? '').trim(),
        username: String(data.get('username') ?? '').trim(),
        email: String(data.get('email') ?? '').trim() || null,
        phoneNumber: String(data.get('phoneNumber') ?? '').trim() || null,
      })
      onCreated(parent)
      setCreated(parent)
      onNotify('success', 'Parent account created successfully.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally {
      setSaving(false)
    }
  }

  return <section className="management-parent-create-page">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to parents</button>
    <article className="management-section-card management-directory-card management-parent-create-card">
      <div className="management-section-heading"><div><p className="management-eyebrow">FAMILY CONNECTIONS</p><h2>{created ? 'Parent account created' : 'Parent information'}</h2><p>{created ? 'The new account is now listed in this school.' : 'Create a parent account for this school.'}</p></div>{created && <span className="management-created-mark" aria-hidden="true">✓</span>}</div>
      {created ? <>
        <div className="management-student-created-summary"><strong>{created.firstName} {created.lastName}</strong><span>Username · {created.username}</span>{created.email && <span>Email · {created.email}</span>}{created.phoneNumber && <span>Phone · {created.phoneNumber}</span>}</div>
        <section className="management-student-credentials" aria-labelledby="parent-credentials-title"><p className="management-eyebrow" id="parent-credentials-title">PARENT SIGN-IN · SHOWN ONCE</p><div><small>USERNAME</small><strong>{created.username}</strong></div><div><small>TEMPORARY PASSWORD</small><strong>{created.initialPassword}</strong></div><p>Share these details securely. The parent must replace this temporary password when signing in.</p></section>
        <div className="management-student-created-actions"><span>Link this account to a student from this school’s directory to grant student access.</span><button className="management-student-create-submit" type="button" onClick={onBack}>Return to parents <Icon name="arrow" /></button></div>
      </> : <>
        <div className="management-parent-directory-note management-parent-directory-note-with-mascot"><div><strong>One account for this school</strong><span>Creating this account does not grant access to student records. Link the parent to a student in this school to provide access.</span></div><StaticGuideMascot /></div>
        <form className="management-form management-parent-create-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="management-form-grid"><label className="management-form-field"><span>First name</span><input name="firstName" autoComplete="given-name" maxLength={100} required /></label><label className="management-form-field"><span>Last name</span><input name="lastName" autoComplete="family-name" maxLength={100} required /></label><label className="management-form-field management-form-wide"><span>Username</span><input name="username" autoComplete="off" maxLength={255} required /></label><label className="management-form-field"><span>Email address · optional</span><input name="email" type="email" autoComplete="email" maxLength={254} /></label><label className="management-form-field"><span>Phone number · optional</span><input name="phoneNumber" type="tel" autoComplete="tel" maxLength={32} /></label></div>
          <div className="management-global-info management-parent-signin-note"><StaticGuideMascot /><span><strong>Initial sign-in details</strong><span>A temporary password will be generated and shown once after the account is created. The parent must change it at first sign-in.</span></span></div>
          <div className="management-student-form-actions"><span>Link this parent to a student in this school to grant access.</span><button className="management-student-create-submit" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create parent account'} <Icon name="arrow" /></button></div>
        </form>
      </>}
    </article>
  </section>
}

function ParentDetails({ parent, parentChoices, loading, error, token, onBack, onSessionExpired, onNotify, onSaved }: { parent: SchoolParent | null; parentChoices: SchoolParent[]; loading: boolean; error: string; token: string; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onSaved: (parent: SchoolParent) => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [statusAction, setStatusAction] = useState<'archive' | 'restore' | null>(null)
  const [resetCredentials, setResetCredentials] = useState<AdminPasswordReset | null>(null)
  const [linkedStudents, setLinkedStudents] = useState<ParentLinkedStudent[]>([])
  const [availableStudents, setAvailableStudents] = useState<ParentLinkedStudent[]>([])
  const [studentLinksLoading, setStudentLinksLoading] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [pendingMoveStudent, setPendingMoveStudent] = useState<ParentLinkedStudent | null>(null)
  const [pendingUnlinkStudentId, setPendingUnlinkStudentId] = useState<number | null>(null)
  const [replacementParentIds, setReplacementParentIds] = useState<Record<number, string>>({})
  const [pendingReassignment, setPendingReassignment] = useState<{ student: ParentLinkedStudent; target: SchoolParent } | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const initializedParentId = useRef<number | null>(null)
  const changed = Boolean(parent && (firstName !== parent.firstName || lastName !== parent.lastName))

  useEffect(() => {
    if (!parent || initializedParentId.current === parent.parentProfileId) return
    initializedParentId.current = parent.parentProfileId
    setFirstName(parent.firstName)
    setLastName(parent.lastName)
    setResetCredentials(null)
  }, [parent])

  const parentProfileId = parent?.parentProfileId
  const loadStudentLinks = useCallback(async () => {
    if (parentProfileId == null) return
    setStudentLinksLoading(true)
    try {
      const base = `/api/school-admin/parents/${parentProfileId}`
      const [linked, available] = await Promise.all([
        getJson<ParentLinkedStudent[]>(`${base}/students`, token),
        getJson<ParentLinkedStudent[]>(`${base}/available-students`, token),
      ])
      setLinkedStudents(linked)
      setAvailableStudents(available)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setStudentLinksLoading(false) }
  }, [parentProfileId, token, onSessionExpired, onNotify])

  useEffect(() => { void loadStudentLinks() }, [loadStudentLinks])

  const commitStudentLink = async (student: ParentLinkedStudent) => {
    if (!parent || !parent.active) return
    setLinkBusy(true)
    try {
      const updated = await postJson<SchoolParent>(`/api/school-admin/parents/${parent.parentProfileId}/students/${student.studentProfileId}`, token, {})
      onSaved(updated)
      setSelectedStudentId('')
      setPendingMoveStudent(null)
      await loadStudentLinks()
      onNotify('success', `${student.firstName} ${student.lastName} is now linked to this parent account.`)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setLinkBusy(false) }
  }

  const requestStudentLink = () => {
    const student = availableStudents.find((item) => String(item.studentProfileId) === selectedStudentId)
    if (!student || !parent?.active) return
    if (student.parentProfileId && student.parentProfileId !== parent.parentProfileId) setPendingMoveStudent(student)
    else void commitStudentLink(student)
  }

  const unlinkStudent = async (student: ParentLinkedStudent) => {
    if (!parent) return
    setLinkBusy(true)
    try {
      const updated = await deleteJson<SchoolParent>(`/api/school-admin/parents/${parent.parentProfileId}/students/${student.studentProfileId}`, token)
      onSaved(updated)
      setPendingUnlinkStudentId(null)
      await loadStudentLinks()
      onNotify('success', `${student.firstName} ${student.lastName} has been unlinked from this parent account.`)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setLinkBusy(false) }
  }

  const reassignRequiredStudent = async (student: ParentLinkedStudent, target: SchoolParent) => {
    if (!parent || !target.active) return
    setLinkBusy(true)
    try {
      const movedParent = await postJson<SchoolParent>(`/api/school-admin/parents/${target.parentProfileId}/students/${student.studentProfileId}`, token, {})
      onSaved(movedParent)
      const updatedParent = await getJson<SchoolParent>(`/api/school-admin/parents/${parent.parentProfileId}`, token)
      onSaved(updatedParent)
      setPendingReassignment(null)
      setReplacementParentIds((current) => ({ ...current, [student.studentProfileId]: '' }))
      await loadStudentLinks()
      onNotify('success', `${student.firstName} ${student.lastName} is now linked to ${target.firstName} ${target.lastName}.`)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setLinkBusy(false) }
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!parent || !changed) return
    setSaving(true)
    try {
      const updated = await putJson<SchoolParent>(`/api/school-admin/parents/${parent.parentProfileId}`, token, { firstName: firstName.trim(), lastName: lastName.trim() })
      onSaved(updated)
      onNotify('success', 'Parent name updated across the shared family account.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setSaving(false) }
  }

  const resetPassword = async () => {
    if (!parent || !parent.active || changed) return
    setBusy(true)
    try {
      const result = await postJson<AdminPasswordReset>(`/api/school-admin/accounts/${parent.userAccountId}/password-reset`, token, {})
      setResetCredentials(result)
      onSaved({ ...parent, mustChangePassword: true })
      onNotify('success', 'A temporary password was created. Give it to the parent securely; it must be changed at sign-in.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setBusy(false) }
  }

  const updateStatus = async () => {
    if (!parent || !statusAction) return
    setBusy(true)
    try {
      const updated = await postJson<SchoolParent>(`/api/school-admin/parents/${parent.parentProfileId}/${statusAction}`, token, {})
      onSaved(updated)
      setStatusAction(null)
      setResetCredentials(null)
      onNotify('success', statusAction === 'archive' ? 'Parent account archived. Sign-in is disabled.' : 'Parent account restored and sign-in is available again.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setBusy(false) }
  }

  if (loading) return <section className="management-student-create-page"><button className="management-student-back-link" type="button" onClick={onBack}>← Back to parents</button><div className="management-empty">Loading parent details…</div></section>
  if (!parent) return <section className="management-student-create-page"><button className="management-student-back-link" type="button" onClick={onBack}>← Back to parents</button><div className="management-empty">{error || 'Parent details are unavailable.'}</div></section>

  return <section className="management-student-create-page">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to parents</button>
    <article className="management-student-record management-parent-record">
      <aside className="management-student-record-rail"><span>PARENT RECORD</span><strong>{String(parent.parentProfileId).padStart(2, '0')}</strong><i /><small>FAMILY ACCOUNT</small></aside>
      <div className="management-student-record-main">
        <header className="management-student-record-head"><span className="management-table-avatar parent">{initials(`${parent.firstName} ${parent.lastName}`)}</span><div><p className="management-eyebrow">FAMILY CONNECTIONS · PROFILE</p><h2>{parent.firstName} {parent.lastName}</h2><p className="management-student-record-meta">{parent.username}<span className={'management-student-status' + (parent.active ? ' is-active' : '')}><i />{parent.active ? 'Active' : 'Archived'}</span></p></div></header>
        <form className="management-form management-student-record-form" onSubmit={(event) => void save(event)}>
          <div className="management-student-record-section"><p className="management-eyebrow">PARENT INFORMATION</p><span className="management-student-record-caption">Names are shared across this parent account’s linked children</span></div>
          <div className="management-form-grid"><label className="management-form-field"><span>First name</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} required disabled={!parent.active || saving || busy} /></label><label className="management-form-field"><span>Last name</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} required disabled={!parent.active || saving || busy} /></label></div>
          <div className="management-student-account-strip"><div><small>PARENT USERNAME</small><strong>{parent.username}</strong></div><div><small>EMAIL ADDRESS</small><strong>{parent.email || 'Not provided'}{parent.email && <em className={parent.emailVerified ? 'is-verified' : 'is-unverified'}>{parent.emailVerified ? 'Verified' : 'Not verified'}</em>}</strong></div><div><small>PHONE NUMBER</small><strong>{parent.phoneNumber || 'Not provided'}</strong></div><div><small>ACCOUNT CREATED</small><strong>{parent.createdAt ? formatDate(parent.createdAt) : '—'}</strong></div></div>
          <div className="management-parent-shared-note"><div><strong>Family account</strong><span>New parent accounts are created for one school. Older linked records may include students at other schools; name changes appear in linked student views, while contact details remain parent-managed. Resetting or archiving affects this sign-in and all its existing links.</span></div><div className="management-parent-note-mascot" role="img" aria-label="ClassBridge guide"><img src="/images/beaver-guide-cutout.png" alt="" /></div></div>
          {parent.mustChangePassword && parent.active && <div className="management-form-hint">A temporary password is active. The parent must choose a new password before continuing.</div>}
          <div className="management-student-form-actions"><span>{parent.active ? 'Updates to the name apply to this shared parent profile.' : 'Archived accounts are read-only until restored.'}</span><div className="management-student-action-buttons">{parent.active && <button className="management-student-secondary-action" type="button" onClick={() => void resetPassword()} disabled={busy || saving || changed} aria-busy={busy && !statusAction} title={changed ? 'Save or discard the name changes first.' : undefined}>{busy && !statusAction ? 'Working…' : 'Reset password'}</button>}<button className={parent.active ? 'management-student-archive-button' : 'management-student-secondary-action'} type="button" onClick={() => setStatusAction(parent.active ? 'archive' : 'restore')} disabled={busy || saving || changed || (parent.active && parent.children.length > 0)} aria-busy={busy && statusAction !== null} title={parent.active && parent.children.length ? 'Move active student links before archiving the shared account.' : changed ? 'Save or discard the name changes first.' : undefined}>{parent.active ? 'Archive parent' : 'Restore parent'}</button><button className="management-student-save-button" type="submit" disabled={!parent.active || !changed || saving || busy} aria-busy={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></div>
          {parent.active && parent.children.length > 0 && <p className="management-parent-archive-note">Move active student links to another parent before archiving this shared account.</p>}
        </form>
        <section className="management-parent-children"><div className="management-student-record-section"><p className="management-eyebrow">STUDENTS IN THIS SCHOOL</p><span className="management-student-record-caption">Link a student here, or update their family link</span></div>{studentLinksLoading ? <p className="management-table-muted">Loading student links…</p> : linkedStudents.length ? <ul>{linkedStudents.map((student) => <li key={student.studentProfileId}><span><strong>{student.firstName} {student.lastName}</strong><small>Grade {student.gradeLevel} · {student.sectionName}</small></span>{parent.active && (student.gradeLevel >= 9 ? pendingUnlinkStudentId === student.studentProfileId ? <span className="management-parent-link-confirm"><span>Remove this student’s family link?</span><button className="management-parent-inline-button is-danger" type="button" onClick={() => void unlinkStudent(student)} disabled={linkBusy}>{linkBusy ? 'Removing…' : 'Confirm remove'}</button><button className="management-parent-inline-button is-quiet" type="button" onClick={() => setPendingUnlinkStudentId(null)} disabled={linkBusy}>Cancel</button></span> : <button className="management-parent-inline-button is-danger" type="button" onClick={() => setPendingUnlinkStudentId(student.studentProfileId)} disabled={linkBusy}>Remove link</button> : pendingReassignment?.student.studentProfileId === student.studentProfileId ? <span className="management-parent-link-confirm"><span>Move {student.firstName} to {pendingReassignment.target.firstName} {pendingReassignment.target.lastName}?</span><button className="management-parent-inline-button" type="button" onClick={() => void reassignRequiredStudent(student, pendingReassignment.target)} disabled={linkBusy}>{linkBusy ? 'Moving…' : 'Confirm move'}</button><button className="management-parent-inline-button is-quiet" type="button" onClick={() => setPendingReassignment(null)} disabled={linkBusy}>Cancel</button></span> : <span className="management-parent-reassign"><small className="management-parent-required-link">A parent link is required for this grade.</small><select aria-label={`Reassign ${student.firstName} ${student.lastName} to another parent`} value={replacementParentIds[student.studentProfileId] ?? ''} onChange={(event) => setReplacementParentIds((current) => ({ ...current, [student.studentProfileId]: event.target.value }))} disabled={linkBusy}><option value="">Choose replacement parent</option>{parentChoices.filter((choice) => choice.parentProfileId !== parent.parentProfileId).map((choice) => <option key={choice.parentProfileId} value={choice.parentProfileId}>{choice.firstName} {choice.lastName} · {choice.username}</option>)}</select><button className="management-parent-inline-button is-quiet" type="button" onClick={() => { const target = parentChoices.find((choice) => String(choice.parentProfileId) === replacementParentIds[student.studentProfileId]); if (target) setPendingReassignment({ student, target }) }} disabled={linkBusy || !replacementParentIds[student.studentProfileId]}>Reassign</button></span>)}</li>)}</ul> : <p className="management-table-muted">No active student links in this school.</p>}
          {parent.active && <div className="management-parent-link-student"><label className="management-form-field"><span>Add a student from this school</span><select value={selectedStudentId} onChange={(event) => { setSelectedStudentId(event.target.value); setPendingMoveStudent(null) }} disabled={linkBusy || studentLinksLoading}><option value="">Choose a student</option>{availableStudents.map((student) => <option key={student.studentProfileId} value={student.studentProfileId}>{student.firstName} {student.lastName} · Grade {student.gradeLevel} · {student.sectionName}{student.parentDisplayName ? ` · currently linked to ${student.parentDisplayName}` : ' · no parent linked'}</option>)}</select></label><button className="management-parent-inline-button is-primary" type="button" onClick={requestStudentLink} disabled={linkBusy || studentLinksLoading || !selectedStudentId}>{linkBusy ? 'Working…' : 'Link student'}</button></div>}
          {availableStudents.length === 0 && !studentLinksLoading && parent.active && <p className="management-table-muted">There are no other active students to link in this school.</p>}
          {pendingMoveStudent && <div className="management-parent-move-confirm" role="alert"><div><strong>Change this student’s family link?</strong><span>{pendingMoveStudent.firstName} {pendingMoveStudent.lastName} is currently linked to {pendingMoveStudent.parentDisplayName}. Linking them here will move the student to {parent.firstName} {parent.lastName}.</span></div><button className="management-parent-inline-button" type="button" onClick={() => void commitStudentLink(pendingMoveStudent)} disabled={linkBusy}>{linkBusy ? 'Moving…' : 'Move student'}</button><button className="management-parent-inline-button is-quiet" type="button" onClick={() => setPendingMoveStudent(null)} disabled={linkBusy}>Cancel</button></div>}
        </section>
      </div>
    </article>
    {resetCredentials && <section className="management-student-credentials management-parent-reset-credentials" aria-live="polite"><p className="management-eyebrow">TEMPORARY PASSWORD · SHOWN ONCE</p><div><small>USERNAME</small><strong>{resetCredentials.username}</strong></div><div><small>TEMPORARY PASSWORD</small><strong>{resetCredentials.temporaryPassword}</strong></div><p>Share these details securely. The parent must change the password at their next sign-in.</p><button className="management-secondary-button" type="button" onClick={() => setResetCredentials(null)}>Close</button></section>}
    {statusAction && <div className="management-modal-backdrop management-student-status-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setStatusAction(null) }}><section className="management-student-status-dialog" role="dialog" aria-modal="true" aria-labelledby="management-parent-status-title" aria-describedby="management-parent-status-description"><aside className="management-student-status-guide" aria-label="ClassBridge mascot"><p className="management-eyebrow">CLASSBRIDGE GUIDE</p><div className="management-student-status-mascot"><img className="management-pose-rest" src="/images/beaver-guide-cutout.png" alt="" /><img className="management-pose-hover" src="/images/beaver-guide-wave.png" alt="" aria-hidden="true" /></div><span className="management-student-status-bubble">One step at a time!</span></aside><div className="management-student-status-copy"><button className="management-modal-close management-student-status-close" type="button" onClick={() => setStatusAction(null)} disabled={busy} aria-label="Close confirmation">×</button><p className="management-eyebrow">SHARED PARENT ACCOUNT</p><h2 id="management-parent-status-title">{statusAction === 'archive' ? 'Archive this parent?' : 'Restore this parent?'}</h2><p id="management-parent-status-description">{statusAction === 'archive' ? `${parent.firstName} ${parent.lastName} will lose sign-in access to the shared account. This is allowed only when no active student or other school is using it.` : `${parent.firstName} ${parent.lastName} will be able to sign in to the shared account again.`}</p><footer className="management-student-status-actions"><button className="management-secondary-button" type="button" onClick={() => setStatusAction(null)} disabled={busy} autoFocus>{statusAction === 'archive' ? 'Keep active' : 'Not now'}</button><button className={statusAction === 'archive' ? 'management-danger-button' : 'management-primary-button'} type="button" onClick={() => void updateStatus()} disabled={busy}>{busy ? 'Working…' : statusAction === 'archive' ? 'Archive parent' : 'Restore parent'}</button></footer></div></section></div>}
  </section>
}

function StudentCreatePage({ classrooms, parents, token, onBack, onSessionExpired, onNotify, onCreated, onAddParent }: { classrooms: Classroom[]; parents: SchoolParent[]; token: string; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onCreated: () => void; onAddParent: () => void }) {
  const [selectedClassroomId, setSelectedClassroomId] = useState('')
  const [selectedParentUsername, setSelectedParentUsername] = useState('')
  const [parentSearch, setParentSearch] = useState('')
  const [parentPickerOpen, setParentPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<CreatedStudent | null>(null)
  const selectedClassroom = classrooms.find((classroom) => String(classroom.id) === selectedClassroomId)
  const highSchool = (selectedClassroom?.gradeLevel ?? 0) >= 9
  const filteredParents = parents.filter((parent) => `${parent.firstName} ${parent.lastName} ${parent.username} ${parent.email ?? ''}`.toLowerCase().includes(parentSearch.trim().toLowerCase()))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setSaving(true)
    try {
      const result = await postJson<CreatedStudent>('/api/school-admin/students', token, {
        firstName: String(formData.get('firstName') ?? '').trim(),
        lastName: String(formData.get('lastName') ?? '').trim(),
        schoolNumber: String(formData.get('schoolNumber') ?? '').trim(),
        classroomId: Number(formData.get('classroomId')),
        studentUsername: highSchool ? String(formData.get('studentUsername') ?? '').trim() : null,
        parentUsername: selectedParentUsername || null,
        email: highSchool ? String(formData.get('email') ?? '').trim() || null : null,
        phoneNumber: highSchool ? String(formData.get('phoneNumber') ?? '').trim() || null : null,
      })
      setCreated(result)
      onCreated()
      onNotify('success', 'Student profile created successfully.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally {
      setSaving(false)
    }
  }

  return <section className="management-student-create-page">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to students</button>
    {created ? <section className="management-section-card management-directory-card management-student-created-card">
      <div className="management-section-heading"><div><p className="management-eyebrow">SCHOOL ROSTER · COMPLETE</p><h2>Student profile created</h2></div><span className="management-created-mark" aria-hidden="true">✓</span></div>
      <div className="management-student-created-summary"><strong>{created.firstName} {created.lastName}</strong><span>School number {created.schoolNumber}</span><span>Grade {created.gradeLevel} · {created.sectionName}</span>{created.parentUsername && <span>Linked parent · {created.parentUsername}</span>}</div>
      {created.studentUsername && created.initialPassword ? <section className="management-student-credentials" aria-labelledby="student-credentials-title"><p className="management-eyebrow" id="student-credentials-title">STUDENT SIGN-IN</p><div><small>USERNAME</small><strong>{created.studentUsername}</strong></div><div><small>TEMPORARY PASSWORD</small><strong>{created.initialPassword}</strong></div><p>Share these credentials securely. The student must replace this temporary password before using the workspace.</p></section> : <div className="management-global-info"><strong>Parent account linked</strong><span>This student uses the linked parent account to access ClassBridge.</span></div>}
      <div className="management-student-created-actions"><span>The profile has been added to your school roster.</span><button className="management-student-create-submit" type="button" onClick={onBack}>Return to students <Icon name="arrow" /></button></div>
    </section> : <section className="management-section-card management-directory-card management-student-create-card">
      <div className="management-section-heading"><div><p className="management-eyebrow">SCHOOL ROSTER</p><h2>Student information</h2></div></div>
      {classrooms.length === 0 ? <div className="management-empty">Create a classroom before enrolling a student.</div> : <form className="management-form management-student-create-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="management-form-grid">
          <label className="management-form-field"><span>First name</span><input name="firstName" autoComplete="given-name" maxLength={100} placeholder="Student first name" required /></label>
          <label className="management-form-field"><span>Last name</span><input name="lastName" autoComplete="family-name" maxLength={100} placeholder="Student last name" required /></label>
          <label className="management-form-field"><span>School number</span><input name="schoolNumber" maxLength={50} placeholder="e.g. 2026-014" required /></label>
          <label className="management-form-field"><span>Classroom</span><select name="classroomId" value={selectedClassroomId} onChange={(event) => setSelectedClassroomId(event.target.value)} required><option value="" disabled>Select a classroom</option>{classrooms.map((room) => <option key={room.id} value={room.id}>Grade {room.gradeLevel} · {room.sectionName}</option>)}</select></label>
        </div>
        {selectedClassroom && <>
          <div className="management-student-create-section"><p className="management-eyebrow">ACCOUNT ACCESS</p><span>{highSchool ? 'High-school students sign in with their own account.' : 'Connect this student to an existing parent account.'}</span></div>
          <div className="management-form-grid">
            {highSchool && <label className="management-form-field"><span>Student username</span><input name="studentUsername" autoComplete="off" maxLength={255} placeholder="Choose a unique username" required /></label>}
            <div className={'management-form-field management-parent-picker' + (highSchool ? '' : ' management-form-wide')}>
              <label htmlFor="student-parent-search"><span>Parent account{highSchool ? ' · optional' : ''}</span></label>
              <input id="student-parent-search" type="search" autoComplete="off" value={parentSearch} placeholder="Search registered parents by name or username" aria-expanded={parentPickerOpen} aria-controls="student-parent-options" aria-autocomplete="list" onFocus={() => setParentPickerOpen(true)} onBlur={() => setParentPickerOpen(false)} onChange={(event) => { setParentSearch(event.target.value); setSelectedParentUsername(''); setParentPickerOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') setParentPickerOpen(false); if (event.key === 'Enter' && parentPickerOpen && filteredParents.length) { event.preventDefault(); const parent = filteredParents[0]; setSelectedParentUsername(parent.username); setParentSearch(`${parent.firstName} ${parent.lastName} · ${parent.username}`); setParentPickerOpen(false) } }} />
              {selectedParentUsername && <small className="management-parent-selected">Selected account: {selectedParentUsername}</small>}
              {parentPickerOpen && <div className="management-parent-options" id="student-parent-options" role="listbox">{filteredParents.length ? filteredParents.map((parent) => <button key={parent.parentProfileId} type="button" role="option" aria-selected={selectedParentUsername === parent.username} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedParentUsername(parent.username); setParentSearch(`${parent.firstName} ${parent.lastName} · ${parent.username}`); setParentPickerOpen(false) }}><strong>{parent.firstName} {parent.lastName}</strong><span>{parent.username}{parent.children.length ? ` · ${parent.children.length} linked student${parent.children.length === 1 ? '' : 's'}` : ' · no linked students yet'}</span></button>) : <p>No registered parent accounts match this search.</p>}<button className="management-parent-add-inline" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setParentPickerOpen(false); onAddParent() }}><Icon name="plus" /> Add a parent account</button></div>}
              {!highSchool && !selectedParentUsername && <small className="management-form-error-note">Select an existing parent account for this student.</small>}
            </div>
          </div>
          {highSchool && <>
            <div className="management-form-grid"><label className="management-form-field"><span>Email address · optional</span><input name="email" type="email" autoComplete="email" maxLength={254} placeholder="student@example.com" /></label><label className="management-form-field"><span>Phone number · optional</span><input name="phoneNumber" type="tel" autoComplete="tel" maxLength={32} placeholder="Student phone number" /></label></div>
            <div className="management-global-info management-student-signin-note"><span className="management-student-note-mascot is-static" aria-hidden="true"><img className="management-pose-rest" src="/images/beaver-guide-cutout.png" alt="" /></span><span className="management-student-note-copy"><strong>Initial sign-in details</strong><span>A temporary password will be generated and shown once. The student must change it before entering the workspace.</span></span></div>
          </>}
        </>}
        <footer className="management-student-form-actions"><span>Student records are created in this school only.</span><button className="management-student-create-submit" type="submit" disabled={saving || !selectedClassroom || (!highSchool && !selectedParentUsername)}>{saving ? 'Creating…' : 'Create student profile'} <Icon name="arrow" /></button></footer>
      </form>}
    </section>}
  </section>
}

function StudentRosterMascots() {
  return <div className="management-student-roster-mascots management-mascot-duo" role="img" tabIndex={0} aria-label="ClassBridge beaver mascot with a student otter" title="Meet your school guides">
    <img src="/images/classbridge-student-roster-duo.png" alt="" />
    <span className="management-student-roster-bubble">Ready to learn?</span>
  </div>
}

function StaticGuideMascot() {
  return <span className="management-static-guide-mascot" aria-hidden="true"><img src="/images/beaver-guide-cutout.png" alt="" /></span>
}

function TeacherRosterMascots() {
  return <div className="management-teacher-roster-mascots" role="img" tabIndex={0} aria-label="ClassBridge beaver mascot sharing a book with a teacher owl">
    <img className="management-teacher-roster-duo" src="/images/classbridge-teacher-roster-duo.png" alt="" />
    <span className="management-teacher-roster-bubble">Let’s learn together!</span>
  </div>
}

function ParentRosterMascots() {
  return <div className="management-parent-roster-mascots" role="img" tabIndex={0} aria-label="ClassBridge beaver mascot with a student fox between the student’s mother and the mascot">
    <span className="management-parent-roster-family-frame" aria-hidden="true">
      <img className="management-parent-roster-family management-family-rest" src="/images/parent-family-roster-sprite.png" alt="" />
      <img className="management-parent-roster-family management-family-laugh" src="/images/parent-family-roster-sprite.png" alt="" />
    </span>
    <span className="management-parent-roster-bubble">Growing together!</span>
  </div>
}

function ParentCreateDialog({ token, onClose, onSessionExpired, onNotify, onCreated }: { token: string; onClose: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onCreated: (parent: CreatedParent | SchoolParent) => void }) {
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState<CreatedParent | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSaving(true)
    try {
      const parent = await postJson<CreatedParent>('/api/school-admin/parents', token, {
        firstName: String(data.get('firstName') ?? '').trim(),
        lastName: String(data.get('lastName') ?? '').trim(),
        username: String(data.get('username') ?? '').trim(),
        email: String(data.get('email') ?? '').trim() || null,
        phoneNumber: String(data.get('phoneNumber') ?? '').trim() || null,
      })
      onCreated(parent)
      setCompleted(parent)
      onNotify('success', 'Parent account created successfully.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally {
      setSaving(false)
    }
  }

  return <div className="management-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) onClose() }}>
    <section className="management-modal management-parent-create-modal" role="dialog" aria-modal="true" aria-labelledby="management-parent-create-title">
      <header className="management-modal-head"><div><p className="management-eyebrow">FAMILY CONNECTIONS</p><h2 id="management-parent-create-title">{completed ? 'Parent account created' : 'Add a parent account'}</h2><p>{completed ? 'The new account is now available in this school’s parent picker.' : 'Create a parent account for this school.'}</p></div><button type="button" className="management-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header>
      {completed ? <>
        <div className="management-student-credentials management-parent-created-credentials" aria-live="polite"><p className="management-eyebrow">INITIAL SIGN-IN · SHOWN ONCE</p><div><small>USERNAME</small><strong>{completed.username}</strong></div><div><small>TEMPORARY PASSWORD</small><strong>{completed.initialPassword}</strong></div><p>Share these details securely. The parent must change this password at first sign-in. Link this parent to a student in this school to grant access.</p></div>
        <footer className="management-modal-actions"><button className="management-primary-button" type="button" onClick={onClose}>Done</button></footer>
      </> : <>
        <div className="management-parent-directory-note management-parent-directory-note-with-mascot"><div><strong>One account for this school</strong><span>Creating this account does not grant access to student records. Link the parent to a student in this school to provide access.</span></div><StaticGuideMascot /></div>
        <form className="management-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="management-form-grid"><label className="management-form-field"><span>First name</span><input name="firstName" autoComplete="given-name" maxLength={100} required /></label><label className="management-form-field"><span>Last name</span><input name="lastName" autoComplete="family-name" maxLength={100} required /></label><label className="management-form-field management-form-wide"><span>Username</span><input name="username" autoComplete="off" maxLength={255} required /></label><label className="management-form-field"><span>Email address · optional</span><input name="email" type="email" autoComplete="email" maxLength={254} /></label><label className="management-form-field"><span>Phone number · optional</span><input name="phoneNumber" type="tel" autoComplete="tel" maxLength={32} /></label></div>
        <footer className="management-modal-actions"><button className="management-secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="management-primary-button" type="submit" disabled={saving}>{saving ? (mode === 'new' ? 'Creating…' : 'Registering…') : (mode === 'new' ? 'Create parent account' : 'Add existing parent')}</button></footer>
        </form>
      </>}
    </section>
  </div>
}

function PreviewDialog({ form, record, classrooms, onClose, onSubmit, notice }: { form: Exclude<PreviewForm, null>; record: PreviewRecord; classrooms: Classroom[]; onClose: () => void; onSubmit: () => void; notice: string }) {
  const [parentMode, setParentMode] = useState<'existing' | 'new'>('existing')
  const isDelete = form === 'announcementDelete'
  const teacherRecord = form === 'teacherEdit' ? record as TeacherPreview | null : null
  const parentRecord = form === 'parent' ? record as ParentPreview | null : null
  const classroomRecord = form === 'classroomEdit' ? record as Classroom | null : null
  const title = form === 'teacher' ? 'Add a teacher' : form === 'teacherEdit' ? 'Edit teacher account' : form === 'parent' ? 'Connect a parent account' : form === 'classroom' ? 'Create a classroom' : form === 'classroomEdit' ? 'Edit classroom' : form === 'announcement' ? 'New announcement' : 'Delete announcement?'
  const subtitle = form === 'parent' ? 'Reuse one parent account for every linked child.' : isDelete ? 'This action will remove this announcement from the school noticeboard.' : 'Review the form layout and account details.'
  return <div className="management-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section className="management-modal" role="dialog" aria-modal="true" aria-labelledby="management-modal-title">
      <header className="management-modal-head"><div><p className="management-eyebrow">SCHOOL OFFICE</p><h2 id="management-modal-title">{title}</h2><p>{subtitle}</p></div><button type="button" className="management-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header>
      <div className="management-modal-preview-note">Design preview · submitting this form will not save or change records.</div>
      {form === 'parent' && <div className="management-parent-mode"><button type="button" className={parentMode === 'existing' ? 'is-selected' : ''} onClick={() => setParentMode('existing')}>Link an existing account</button><button type="button" className={parentMode === 'new' ? 'is-selected' : ''} onClick={() => setParentMode('new')}>Create a new account</button></div>}
      <form className="management-form" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
        {(form === 'teacher' || form === 'teacherEdit') && <><div className="management-form-grid"><FormField label="First name" placeholder="Teacher first name" defaultValue={teacherRecord?.firstName} /><FormField label="Last name" placeholder="Teacher last name" defaultValue={teacherRecord?.lastName} /><FormField label="Username" placeholder="Choose a unique username" defaultValue={teacherRecord?.username} /><FormField label="Email address" placeholder="name@school.edu" type="email" defaultValue={teacherRecord?.email} /><FormField label="Phone number" placeholder="Optional" /></div>{form === 'teacher' && <p className="management-form-hint">A one-time initial password will be shown after the account is created.</p>}</>}
        {form === 'parent' && <>{parentMode === 'existing' ? <div className="management-form-grid"><FormField label="Parent username" placeholder="Enter the exact username provided by the family" defaultValue={parentRecord?.username} /><label className="management-form-field management-form-wide"><span>Student to connect</span><select defaultValue=""><option value="" disabled>Select a student</option><option>Can Demir · Grade 9-A</option><option>Elif Kaya · Grade 5-C</option></select></label></div> : <div className="management-form-grid"><FormField label="First name" placeholder="Parent first name" /><FormField label="Last name" placeholder="Parent last name" /><FormField label="Username" placeholder="Choose a unique username" /><FormField label="Email address" placeholder="name@example.com" type="email" /><FormField label="Phone number" placeholder="Optional" /><label className="management-form-field management-form-wide"><span>Student to connect</span><select defaultValue=""><option value="" disabled>Select a student</option><option>Can Demir · Grade 9-A</option><option>Elif Kaya · Grade 5-C</option></select></label></div>}<div className="management-global-info"><strong>One account, multiple children</strong><span>The account can be reused when another child enrolls, even at a different school. Contact and name details belong to the shared parent account.</span></div>{parentMode === 'new' && <p className="management-form-hint">The generated initial password is shown once after creation.</p>}</>}
        {(form === 'classroom' || form === 'classroomEdit') && <div className="management-form-grid"><label className="management-form-field"><span>Grade</span><select defaultValue={classroomRecord ? String(classroomRecord.gradeLevel) : ''}><option value="" disabled>Select a grade</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label><FormField label="Section" placeholder="e.g. A" defaultValue={classroomRecord?.sectionName} /><label className="management-form-field management-form-wide"><span>Homeroom teacher</span><select defaultValue={classroomRecord?.homeroomTeacherAccountId ? String(classroomRecord.homeroomTeacherAccountId) : ''}><option value="" disabled>Select a teacher</option>{teacherPreview.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}</select></label></div>}
        {form === 'announcement' && <><div className="management-form-grid"><FormField label="Title" placeholder="Announcement title" /><label className="management-form-field"><span>Announcement type</span><select defaultValue="GENERAL"><option value="GENERAL">General notice</option><option value="HOMEWORK">Homework</option><option value="EXAM">Exam announcement</option><option value="EXAM_RESULTS">Exam results</option><option value="EVENT">School event</option></select></label><label className="management-form-field management-form-wide"><span>Send to classrooms</span><select multiple size={Math.max(2, Math.min(5, classrooms.length))}>{classrooms.map((room) => <option key={room.id}>Grade {room.gradeLevel} · {room.sectionName}</option>)}</select></label><label className="management-form-field management-form-wide"><span>Message</span><textarea rows={4} placeholder="Write the announcement" /></label></div></>}
        {isDelete && <div className="management-global-info"><strong>Confirmation required</strong><span>In the connected workflow, the announcement and its attached files will be removed from the school noticeboard.</span></div>}
        {notice && <div className="management-preview-response" role="status">{notice}</div>}
        <footer className="management-modal-actions"><button className="management-secondary-button" type="button" onClick={onClose}>Cancel</button><button className={isDelete ? 'management-danger-button' : 'management-primary-button'} type="submit">{isDelete ? 'Confirm delete' : form === 'announcement' ? 'Publish announcement' : form === 'parent' ? (parentMode === 'new' ? 'Create and link parent' : 'Link parent account') : form === 'classroom' ? 'Create classroom' : form === 'classroomEdit' ? 'Save classroom' : form === 'teacherEdit' ? 'Save teacher details' : 'Create teacher'}</button></footer>
      </form>
    </section>
  </div>
}

function FormField({ label, placeholder, type = 'text', defaultValue }: { label: string; placeholder: string; type?: string; defaultValue?: string }) {
  return <label className="management-form-field"><span>{label}</span><input type={type} placeholder={placeholder} defaultValue={defaultValue} /></label>
}

function StudentTable({ students, onOpen }: { students: Student[]; onOpen: (student: Student) => void }) {
  if (!students.length) return <div className="management-empty">There are no profiles in this view.</div>
  return <div className="management-table-wrap management-student-table-wrap"><table className="management-table"><thead><tr><th>STUDENT</th><th>SCHOOL NUMBER</th><th>CLASSROOM</th><th>ACCOUNT</th><th>STATUS</th><th /></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><span className="management-person-cell"><span className="management-table-avatar">{initials(`${student.firstName} ${student.lastName}`)}</span><span><strong>{student.firstName} {student.lastName}</strong><small>{student.parentUsername ? `Parent · ${student.parentUsername}` : 'No linked parent'}</small></span></span></td><td>{student.schoolNumber}</td><td><span className="management-student-class">Grade {student.gradeLevel} · {student.sectionName}</span></td><td>{student.studentUsername || <span className="management-muted">Parent access</span>}</td><td><span className={'management-student-status' + (student.active ? ' is-active' : '')}><i />{student.active ? 'Active' : 'Archived'}</span></td><td><button className="management-detail-button" type="button" onClick={() => onOpen(student)} aria-label={`Open details for ${student.firstName} ${student.lastName}`}>View record <Icon name="arrow" /></button></td></tr>)}</tbody></table></div>
}

function ClassroomList({ rooms, detailed = false, onOpen, teacherChoices = [] }: { rooms: Classroom[]; detailed?: boolean; onOpen?: (room: Classroom) => void; teacherChoices?: TeacherProfile[] }) {
  return <div className={detailed ? 'management-class-list is-detailed' : 'management-class-list'}>{rooms.map((room, index) => {
    const teacher = room.homeroomTeacherAccountId == null ? null : teacherChoices.find((candidate) => candidate.userAccountId === room.homeroomTeacherAccountId)
    return <article className="management-class-row" key={room.id}><span className={'management-class-icon tone-' + (index % 3)}><Icon name="classes" /></span><span className="management-class-copy"><strong>Grade {room.gradeLevel} · {room.sectionName}</strong><small>{teacher ? `Homeroom · ${teacher.firstName} ${teacher.lastName}` : room.homeroomTeacherAccountId ? 'Homeroom teacher assigned' : 'Homeroom teacher not assigned'}</small></span><span className="management-class-grade">{String(room.gradeLevel).padStart(2, '0')}</span>{detailed && onOpen && <button className="management-teacher-detail-button" type="button" onClick={() => onOpen(room)} aria-label={`View Grade ${room.gradeLevel} ${room.sectionName}`}>View record <Icon name="arrow" /></button>}</article>
  })}</div>
}

function AnnouncementCreatePage({ classrooms, token, onBack, onSessionExpired, onNotify, onCreated }: { classrooms: Classroom[]; token: string; onBack: () => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void; onCreated: (announcement: Announcement) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('GENERAL')
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const addFiles = (selection: FileList | null) => {
    if (!selection) return
    const next = Array.from(selection)
    const invalid = next.find((file) => !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024)
    if (invalid) {
      onNotify('error', 'Choose PDF, JPG, or PNG files that are 10 MB or smaller.')
      return
    }
    const merged = [...files]
    next.forEach((file) => { if (!merged.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) merged.push(file) })
    if (merged.length > 5) {
      onNotify('error', 'An announcement can include up to five attachments.')
      return
    }
    setFiles(merged)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (!selectedClassroomIds.length) {
      onNotify('error', 'Select at least one classroom for this announcement.')
      return
    }
    setSaving(true)
    try {
      const created = await postJson<Announcement>('/api/school-admin/announcements', token, {
        title: title.trim(), body: body.trim(), type,
        targetClassroomIds: selectedClassroomIds.map(Number),
      })
      const uploaded: NonNullable<Announcement['attachments']> = []
      const failedUploads: string[] = []
      for (const file of files) {
        try {
          uploaded.push(await postFile<NonNullable<Announcement['attachments']>[number]>(`/api/school-admin/announcements/${created.id}/attachments`, token, file))
        } catch (reason) {
          if (reason instanceof WorkspaceApiError && reason.status === 401) {
            onCreated({ ...created, attachments: uploaded })
            onNotify('error', 'The announcement was published, but sign in again to finish uploading its attachments.')
            onSessionExpired()
            return
          }
          failedUploads.push(`${file.name}: ${errorText(reason)}`)
        }
      }
      onCreated({ ...created, attachments: uploaded })
      if (failedUploads.length) onNotify('error', `The announcement was published. Some attachments could not be uploaded: ${failedUploads.join(' · ')}`)
      else onNotify('success', 'The announcement has been published to the selected classrooms.')
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setSaving(false) }
  }

  return <section className="management-student-create-page management-announcement-page">
    <button className="management-student-back-link" type="button" onClick={onBack} disabled={saving}>← Back to announcements</button>
    <article className="management-section-card management-directory-card management-student-create-card management-announcement-create-card">
      <div className="management-section-heading"><div><p className="management-eyebrow">SCHOOL NOTICEBOARD</p><h2>New announcement</h2><p>Write an update and choose the classrooms that should receive it.</p></div></div>
      <form className="management-form management-student-record-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="management-form-grid management-announcement-form-grid">
          <label className="management-form-field"><span>Title</span><input required maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Announcement title" disabled={saving} /></label>
          <label className="management-form-field"><span>Announcement type</span><select value={type} onChange={(event) => setType(event.target.value)} disabled={saving}>{Object.entries(announcementLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="management-form-field management-form-wide"><span>Message</span><textarea required rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the details for students and families" disabled={saving} /></label>
          <div className="management-form-field management-form-wide management-announcement-classrooms"><span>Send to classrooms <small>Choose at least one class</small></span>{classrooms.length ? <div className="management-announcement-class-options">{classrooms.map((room) => {
            const id = String(room.id)
            const checked = selectedClassroomIds.includes(id)
            return <label className={checked ? 'management-announcement-class-option is-selected' : 'management-announcement-class-option'} key={room.id}><input type="checkbox" checked={checked} onChange={(event) => setSelectedClassroomIds((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} disabled={saving} /><span><strong>Grade {room.gradeLevel} · {room.sectionName}</strong><small>{checked ? 'Included in this announcement' : 'Select this classroom'}</small></span></label>
          })}</div> : <div className="management-empty">Create a classroom before publishing an announcement.</div>}</div>
          <div className="management-form-field management-form-wide management-announcement-attachments"><span>Attachments · optional</span><label className="management-announcement-file-picker"><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple disabled={saving || files.length >= 5} onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = '' }} /><span>Choose files</span><small>PDF, JPG, or PNG · up to 10 MB each · 5 files maximum</small></label>{files.length > 0 && <ul>{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`}><span><strong>{file.name}</strong><small>{(file.size / 1024).toLocaleString('en', { maximumFractionDigits: 0 })} KB</small></span><button type="button" className="management-announcement-remove-file" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} disabled={saving} aria-label={`Remove ${file.name}`}>×</button></li>)}</ul>}</div>
        </div>
        <div className="management-student-form-actions management-announcement-form-actions"><span>Only the selected classrooms will receive this update.</span><div className="management-classroom-form-buttons"><button className="management-secondary-button" type="button" onClick={onBack} disabled={saving}>Cancel</button><button className="management-student-create-submit" type="submit" disabled={saving || !title.trim() || !body.trim() || !classrooms.length || !selectedClassroomIds.length} aria-busy={saving}>{saving ? 'Publishing…' : 'Publish announcement'} <Icon name="arrow" /></button></div></div>
      </form>
    </article>
  </section>
}

function AnnouncementDetailsPage({ announcement, loading, error, token, onBack, onDelete, onSessionExpired, onNotify }: { announcement: Announcement | null; loading: boolean; error: string; token: string; onBack: () => void; onDelete: (announcement: Announcement) => void; onSessionExpired: () => void; onNotify: (kind: WorkspaceToast['kind'], message: string) => void }) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const download = async (attachment: NonNullable<Announcement['attachments']>[number]) => {
    if (!announcement || downloadingId !== null) return
    setDownloadingId(attachment.id)
    try {
      const response = await fetchCached(`/api/school-admin/announcements/${announcement.id}/attachments/${attachment.id}`, { headers: { Authorization: `Bearer ${token}` } }, 0)
      if (!response.ok) {
        const text = await response.text()
        let message = `The file could not be downloaded (${response.status}).`
        try { message = (JSON.parse(text) as { message?: string }).message || message } catch { /* Keep the safe generic message. */ }
        throw new WorkspaceApiError(message, response.status)
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.displayFilename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (reason) {
      if (reason instanceof WorkspaceApiError && reason.status === 401) onSessionExpired()
      else onNotify('error', errorText(reason))
    } finally { setDownloadingId(null) }
  }

  return <section className="management-student-create-page management-announcement-page">
    <button className="management-student-back-link" type="button" onClick={onBack}>← Back to announcements</button>
    {loading && !announcement ? <div className="management-section-card management-empty">Loading announcement details…</div> : error && !announcement ? <div className="management-section-card management-empty">{error}</div> : announcement && <article className="management-section-card management-directory-card management-announcement-detail-card">
      <header className="management-announcement-detail-header"><span className={'management-announcement-symbol type-' + announcement.type.toLowerCase()}><Icon name="announcements" /></span><div><p className="management-eyebrow">{announcementLabel[announcement.type] || announcement.type.replaceAll('_', ' ')}</p><h2>{announcement.title}</h2><p>Shared by <strong>{announcement.authorDisplayName}</strong> · {formatDate(announcement.createdAt)}</p></div><button className="management-row-action management-row-danger" type="button" onClick={() => onDelete(announcement)} aria-label={`Delete announcement ${announcement.title}`}><Icon name="trash" /></button></header>
      <div className="management-announcement-detail-body">{announcement.body.split(/\r?\n/).map((line, index) => <p key={index}>{line || '\u00a0'}</p>)}</div>
      <section className="management-announcement-detail-section"><div className="management-announcement-detail-section-heading"><div><p className="management-eyebrow">AUDIENCE</p><h3>Classrooms receiving this announcement</h3></div><span>{announcement.targetClassrooms.length} classroom{announcement.targetClassrooms.length === 1 ? '' : 's'}</span></div>{announcement.targetClassrooms.length ? <ul className="management-announcement-targets">{announcement.targetClassrooms.map((room) => <li key={room.classroomId ?? `${room.gradeLevel}-${room.sectionName}`}><span className="management-class-icon"><Icon name="classes" /></span><strong>Grade {room.gradeLevel} · {room.sectionName}</strong></li>)}</ul> : <div className="management-empty">No classroom audience information is available.</div>}</section>
      <section className="management-announcement-detail-section"><div className="management-announcement-detail-section-heading"><div><p className="management-eyebrow">FILES</p><h3>Attachments</h3></div><span>{announcement.attachments?.length ?? 0} file{announcement.attachments?.length === 1 ? '' : 's'}</span></div>{announcement.attachments?.length ? <ul className="management-announcement-attachment-list">{announcement.attachments.map((attachment) => <li key={attachment.id}><span><strong>{attachment.displayFilename}</strong><small>{attachment.contentType} · {(attachment.size / 1024).toLocaleString('en', { maximumFractionDigits: 0 })} KB</small></span><button className="management-teacher-detail-button" type="button" onClick={() => void download(attachment)} disabled={downloadingId !== null} aria-busy={downloadingId === attachment.id}>{downloadingId === attachment.id ? 'Downloading…' : 'Download'} <Icon name="arrow" /></button></li>)}</ul> : <div className="management-empty">This announcement has no attachments.</div>}</section>
      <footer className="management-announcement-detail-footer"><span>Created {formatDate(announcement.createdAt)}</span><button className="management-danger-button management-announcement-delete-button" type="button" onClick={() => onDelete(announcement)}><Icon name="trash" /> Delete announcement</button></footer>
    </article>}
  </section>
}

function AnnouncementDeleteDialog({ announcement, saving, onCancel, onConfirm }: { announcement: Announcement; saving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="management-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel() }}><section className="management-modal management-announcement-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="management-announcement-delete-title" aria-describedby="management-announcement-delete-description"><div className="management-announcement-delete-mascot"><img src="/images/beaver-guide-cutout.png" alt="ClassBridge mascot" /></div><div className="management-modal-head"><p className="management-eyebrow">SCHOOL NOTICEBOARD</p><h2 id="management-announcement-delete-title">Delete this announcement?</h2><p id="management-announcement-delete-description">“{announcement.title}” and its attachments will be removed from this school’s noticeboard.</p></div><footer className="management-modal-actions"><button className="management-secondary-button" type="button" onClick={onCancel} disabled={saving}>Keep announcement</button><button className="management-danger-button" type="button" onClick={onConfirm} disabled={saving} aria-busy={saving}>{saving ? 'Deleting…' : 'Delete announcement'}</button></footer></section></div>
}

function AnnouncementList({ items, compact = false, onOpen, onDelete }: { items: Announcement[]; compact?: boolean; onOpen?: (announcement: Announcement) => void; onDelete?: (announcement: Announcement) => void }) {
  if (!items.length) return <div className="management-empty">There are no announcements in this view.</div>
  return <div className={compact ? 'management-announcement-list is-compact' : 'management-announcement-list'}>{items.map((item, index) => <article className="management-announcement-row" key={item.id}><span className="management-announcement-index">{String(index + 1).padStart(2, '0')}</span><span className={'management-announcement-symbol type-' + item.type.toLowerCase()}><Icon name="announcements" /></span><div className="management-announcement-copy"><div className="management-announcement-meta"><span>{announcementLabel[item.type] || item.type.replaceAll('_', ' ')}</span><time>{formatDate(item.createdAt)}</time></div><button className="management-announcement-title-button" type="button" onClick={() => onOpen?.(item)}>{item.title}</button>{!compact && <p>{item.body}</p>}<small>Shared by <strong>{item.authorDisplayName}</strong><i /> {item.targetClassrooms.map((room) => `${room.gradeLevel}-${room.sectionName}`).join(', ') || 'School-wide'}</small></div><div className="management-announcement-row-actions">{onOpen && (compact ? <button className="management-announcement-compact-open" type="button" onClick={() => onOpen(item)} aria-label={`Open announcement ${item.title}`}><Icon name="arrow" /></button> : <button className="management-teacher-detail-button" type="button" onClick={() => onOpen(item)} aria-label={`View announcement ${item.title}`}><span>View details</span><Icon name="arrow" /></button>)}{onDelete && !compact && <button className="management-row-action management-row-danger" type="button" onClick={() => onDelete(item)} aria-label={`Delete announcement ${item.title}`}><Icon name="trash" /></button>}</div></article>)}</div>
}

function SchoolList({ schools, detailed = false }: { schools: School[]; detailed?: boolean }) {
  return <div className={detailed ? 'management-school-list is-detailed' : 'management-school-list'}>{schools.map((school, index) => <article className="management-school-row" key={school.id}><span className={'management-school-tile tone-' + (index % 3)}><Icon name="schools" /></span><span className="management-school-copy"><strong>{school.name}</strong><small>{schoolLevelLabel[school.educationLevel]} · {school.district}, {school.province}</small></span><span className="management-school-level">{school.educationLevel.replaceAll('_', ' ')}</span><span className="management-announcement-arrow" aria-hidden="true">↗</span></article>)}</div>
}
