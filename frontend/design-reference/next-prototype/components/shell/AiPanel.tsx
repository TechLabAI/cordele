'use client'

import { useState } from 'react'

interface AiMessage {
  role: 'user' | 'ai'
  text: string
}

export function AiPanel() {
  const [messages, setMessages] = useState<AiMessage[]>([
    { role: 'ai', text: 'Olá! Sou a AlumIA. Pergunte ou peça sugestões sobre esta tela.' }
  ])
  const [input, setInput] = useState('')

  function send() {
    if (!input.trim()) return
    setMessages(prev => [
      ...prev,
      { role: 'user', text: input },
      { role: 'ai', text: 'Analisando... (modo protótipo — resposta real via API)' }
    ])
    setInput('')
  }

  return (
    <aside className="shell__ai" data-collapsed="true">
      {/* Header */}
      <div style={{
        padding: 'var(--space-4)',
        borderBottom: '1px solid var(--color-panel-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-ai)', fontSize: 18 }}>
          local_fire_department
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-ai)' }}>
          AlumIA
        </span>
        <span style={{
          marginLeft: 'auto',
          background: 'var(--color-ai-bg)',
          color: 'var(--color-ai-ink)',
          borderRadius: 'var(--radius-pill)',
          padding: '2px 8px',
          fontSize: 'var(--text-2xs)',
          fontWeight: 500,
        }}>advisory</span>
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            background: 'var(--color-panel-bubble)',
            border: '1px solid var(--color-panel-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
            color: msg.role === 'ai' ? 'var(--color-panel-text)' : 'var(--color-ink)',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
          }}>
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-panel-border)', position: 'relative' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Perguntar à AlumIA..."
          style={{
            width: '100%',
            height: 36,
            paddingLeft: 'var(--space-3)',
            paddingRight: 40,
            background: 'var(--color-panel-field)',
            border: '1px solid var(--color-panel-border)',
            borderRadius: 'var(--radius-xl)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-panel-text)',
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          style={{
            position: 'absolute',
            right: 'calc(var(--space-4) + 6px)',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 28,
            height: 28,
            background: 'var(--color-ai-fill)',
            color: 'var(--color-ai-on)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
        </button>
      </div>
    </aside>
  )
}
