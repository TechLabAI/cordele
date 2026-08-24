'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

interface NavItem {
  id: string
  label: string
  icon: string
}

interface SidebarProps {
  items: NavItem[]
  projectName: string
  logoSrc?: string
}

export function Sidebar({ items, projectName, logoSrc }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="shell__sidebar">
      {/* Logo / Identidade */}
      <div style={{ padding: 'var(--space-5) var(--space-4)', borderBottom: '1px solid var(--color-line)' }}>
        {logoSrc ? (
          <img src={logoSrc} alt={projectName} style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--color-ink)' }}>
            {projectName}
          </span>
        )}
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, padding: 'var(--space-3) 0' }}>
        {items.map((item) => {
          const isActive = pathname === `/${item.id}` || pathname.startsWith(`/${item.id}/`)
          return (
            <Link
              key={item.id}
              href={`/${item.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-4)',
                margin: '0 var(--space-2)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-brand)' : 'var(--color-ink-soft)',
                background: isActive ? 'var(--color-brand-active)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-line)', fontSize: 'var(--text-xs)', color: 'var(--color-ink-faint)' }}>
        TechLab · Protótipo
      </div>
    </aside>
  )
}
