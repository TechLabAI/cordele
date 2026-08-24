import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import { AiPanel } from '@/components/shell/AiPanel'

export const metadata: Metadata = {
  title: 'Cordelê',
  description: 'Protótipo TechLab — Cordelê',
}

const NAV_ITEMS = [
    { id: 'entrada', label: 'Entrada', icon: '•' },
    { id: 'biblioteca-de-projetos', label: 'Biblioteca De Projetos', icon: '•' },
    { id: 'upload', label: 'Upload', icon: '📤' },
    { id: 'revisao-de-estrutura', label: 'Revisao De Estrutura', icon: '•' },
    { id: 'configuracoes', label: 'Configurações', icon: 'settings' },
    { id: 'edicao-de-layout', label: 'Edicao De Layout', icon: '•' },
    { id: 'exportacao-e-validacao', label: 'Exportacao E Validacao', icon: '•' },
    { id: 'download-e-historico', label: 'Download E Historico', icon: '•' },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="shell">
          <Sidebar
            items={NAV_ITEMS}
            projectName="Cordelê"
            logoSrc="logo.png"
          />
          <div className="shell__main">
            <Topbar projectName="Cordelê" />
            <main className="shell__content">
              {children}
            </main>
          </div>
          <AiPanel />
        </div>
      </body>
    </html>
  )
}
