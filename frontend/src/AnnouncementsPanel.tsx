import { useEffect, useState } from 'react'

type UserRole = 'SUPERADMIN' | 'SCHOOL_ADMIN' | 'SCHOOL_VICE_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT'

type AnnouncementAttachment = {
  id: number
  displayFilename: string
  contentType: string
  size: number
  createdAt: string
}

type Announcement = {
  id: number
  title: string
  body: string
  authorDisplayName: string
  targetClassrooms: { classroomId: number; gradeLevel: number; sectionName: string }[]
  attachments: AnnouncementAttachment[]
  createdAt: string
}

type Child = {
  studentProfileId: number
  firstName: string
  lastName: string
  schoolName: string
  educationLevel: string
}

type Props = {
  token: string
  role: UserRole
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function AnnouncementsPanel({ token, role }: Props) {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoadingChildren, setIsLoadingChildren] = useState(role === 'PARENT')
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false)
  const [error, setError] = useState('')
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null)

  useEffect(() => {
    if (role !== 'PARENT') return

    let isCurrent = true
    async function loadChildren() {
      setIsLoadingChildren(true)
      setError('')
      try {
        const response = await fetch('/api/parent/children', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('We could not load your linked students.')
        const result = (await response.json()) as Child[]
        if (isCurrent) {
          setChildren(result)
          setSelectedChildId((current) => current && result.some((child) => String(child.studentProfileId) === current)
            ? current
            : result[0] ? String(result[0].studentProfileId) : '')
        }
      } catch (loadError) {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'We could not load your linked students.')
      } finally {
        if (isCurrent) setIsLoadingChildren(false)
      }
    }

    void loadChildren()
    return () => { isCurrent = false }
  }, [role, token])

  useEffect(() => {
    if (role === 'SUPERADMIN' || (role === 'PARENT' && !selectedChildId)) return

    let isCurrent = true
    async function loadAnnouncements() {
      setIsLoadingAnnouncements(true)
      setError('')
      const path = role === 'PARENT'
        ? `/api/parent/children/${selectedChildId}/announcements`
        : role === 'STUDENT'
          ? '/api/student/announcements'
          : '/api/announcements'

      try {
        const response = await fetch(path, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('We could not load announcements. Please try again.')
        const result = (await response.json()) as Announcement[]
        if (isCurrent) setAnnouncements(result)
      } catch (loadError) {
        if (isCurrent) {
          setAnnouncements([])
          setError(loadError instanceof Error ? loadError.message : 'We could not load announcements. Please try again.')
        }
      } finally {
        if (isCurrent) setIsLoadingAnnouncements(false)
      }
    }

    void loadAnnouncements()
    return () => { isCurrent = false }
  }, [role, selectedChildId, token])

  async function downloadAttachment(announcementId: number, attachment: AnnouncementAttachment) {
    setDownloadingAttachmentId(attachment.id)
    setError('')
    const basePath = role === 'PARENT'
      ? `/api/parent/children/${selectedChildId}/announcements/${announcementId}/attachments/${attachment.id}`
      : role === 'STUDENT'
        ? `/api/student/announcements/${announcementId}/attachments/${attachment.id}`
        : `/api/announcements/${announcementId}/attachments/${attachment.id}`

    try {
      const response = await fetch(basePath, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('This attachment could not be downloaded. Please try again.')
      const file = await response.blob()
      const objectUrl = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = attachment.displayFilename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'This attachment could not be downloaded.')
    } finally {
      setDownloadingAttachmentId(null)
    }
  }

  const selectedChild = children.find((child) => String(child.studentProfileId) === selectedChildId)
  const heading = role === 'PARENT' && selectedChild
    ? `${selectedChild.firstName}'s school updates`
    : 'School announcements'

  return (
    <section className="announcements-panel" aria-labelledby="announcements-heading">
      <div className="announcements-heading-row">
        <div>
          <p className="eyebrow">SCHOOL COMMUNITY</p>
          <h2 id="announcements-heading">{heading}</h2>
          <p className="announcements-intro">Important notes and updates shared by your school.</p>
        </div>
        {role === 'PARENT' && children.length > 0 && (
          <label className="child-picker-label">
            <span>Viewing updates for</span>
            <select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
              {children.map((child) => (
                <option key={child.studentProfileId} value={child.studentProfileId}>
                  {child.firstName} {child.lastName} · {child.schoolName}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="announcements-error" role="alert">{error}</p>}
      {(isLoadingChildren || isLoadingAnnouncements) && (
        <div className="announcements-empty"><span className="button-spinner" /> Loading announcements…</div>
      )}
      {!isLoadingChildren && !isLoadingAnnouncements && !error && role === 'PARENT' && children.length === 0 && (
        <div className="announcements-empty"><span className="empty-icon">↗</span><h3>No linked students yet</h3><p>Once your school links a student to your account, their school updates will appear here.</p></div>
      )}
      {!isLoadingChildren && !isLoadingAnnouncements && !error && announcements.length === 0 && (role !== 'PARENT' || children.length > 0) && (
        <div className="announcements-empty"><span className="empty-icon">✦</span><h3>You’re all caught up</h3><p>There are no announcements to show right now.</p></div>
      )}
      {!isLoadingAnnouncements && announcements.length > 0 && (
        <div className="announcement-list">
          {announcements.map((announcement) => (
            <article className="announcement-card" key={announcement.id}>
              <div className="announcement-meta-row">
                <span className="announcement-author"><span className="author-avatar">{announcement.authorDisplayName?.charAt(0) ?? 'S'}</span>{announcement.authorDisplayName}</span>
                <time dateTime={announcement.createdAt}>{formatDate(announcement.createdAt)}</time>
              </div>
              <h3>{announcement.title}</h3>
              <p className="announcement-body">{announcement.body}</p>
              {announcement.targetClassrooms.length > 0 && (
                <div className="announcement-targets" aria-label="Target classrooms">
                  {announcement.targetClassrooms.map((classroom) => (
                    <span key={classroom.classroomId}>{classroom.gradeLevel}/{classroom.sectionName}</span>
                  ))}
                </div>
              )}
              {announcement.attachments.length > 0 && (
                <div className="attachment-list">
                  {announcement.attachments.map((attachment) => (
                    <button
                      className="attachment-button"
                      disabled={downloadingAttachmentId === attachment.id}
                      key={attachment.id}
                      onClick={() => void downloadAttachment(announcement.id, attachment)}
                      type="button"
                    >
                      <span className="attachment-icon">↓</span>
                      <span className="attachment-name">{attachment.displayFilename}<small>{formatFileSize(attachment.size)}</small></span>
                      <span className="attachment-action">{downloadingAttachmentId === attachment.id ? 'Loading…' : 'Download'}</span>
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
