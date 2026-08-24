'use client'

import { useState } from 'react'

interface TopbarProps {
  projectName: string
}

export function Topbar({ projectName }: TopbarProps) {
  const [aiOpen, setAiOpen] = useState(false)

  return (
    <header className="shell__topbar">
      <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-ink-soft)' }}>
        {projectName}
      </span>
      <button
        onClick={() => {
          const ai = document.querySelector('.shell__ai') as HTMLElement
          if (ai) ai.dataset.collapsed = ai.dataset.collapsed === 'true' ? 'false' : 'true'
          setAiOpen(!aiOpen)
        }}
        title="Abrir painel AlumIA"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-1) var(--space-3)',
          background: aiOpen ? 'var(--color-ai-bg)' : 'transparent',
          border: '1px solid',
          borderColor: aiOpen ? 'var(--color-ai-fill)' : 'var(--color-line)',
          borderRadius: 'var(--radius-md)',
          color: aiOpen ? 'var(--color-ai)' : 'var(--color-ink-soft)',
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-ai)' }}>local_fire_department</span>
        AlumIA
      </button>
    </header>
  )
}
