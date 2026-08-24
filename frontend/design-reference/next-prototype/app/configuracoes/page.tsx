// Configurações — configuracoes
// Objetivo: Editor preenche os metadados editoriais: título, autor, ISBN, capa, idioma, categoria. Campos obrigatórios são claramente marcados.
// Build-plan: .build-plans/configuracoes.plan.md
import { MOCK_DATA } from '@/lib/mock-data'

export default async function ConfiguracoesPage() {

  // TODO: substituir por fetch real → await fetch('/api/configuracoes')
  const data = MOCK_DATA

  return (
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Configurações</h1>
          <p className="text-sm text-ink-faint mt-1">Editor preenche os metadados editoriais: título, autor, ISBN, capa, idioma, categoria. Campos obrigatórios são claramente marcados.</p>
        </div>
      </div>


  {/* Dados: {JSON.stringify(data, null, 2)} */}
      {/* TODO: implementar conteúdo — ver .build-plans/configuracoes.plan.md */}
      <div className="glass rounded-card p-6">
        <p className="text-ink-soft text-sm">Tela em construção — ver build-plan.</p>
      </div>
    </div>
  )
}
