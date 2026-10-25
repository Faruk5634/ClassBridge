import './WorkspaceTransition.css'

type WorkspaceTone = 'teacher' | 'student' | 'parent'

export default function WorkspaceTransition({ tone, dark = false }: { tone: WorkspaceTone; dark?: boolean }) {
  return <div className={'workspace-transition workspace-transition--' + tone + (dark ? ' is-dark' : '')} role="status" aria-live="polite">
    <img src="/images/beaver-guide-cutout.png" alt="" />
    <p>Loading…</p>
  </div>
}
