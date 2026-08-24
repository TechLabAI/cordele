// Edicao De Layout — edicao-de-layout
// Objetivo: Editor visualiza o manuscrito renderizado página a página com os estilos aplicados. Ajusta tipografia, espaçamento e hierarquia de títulos em tempo real. Pode adicionar páginas em branco, inserir imagens e remover páginas. Confirma que o resultado visual está correto antes de exportar.
// Build-plan: .build-plans/edicao-de-layout.plan.md
import { MOCK_DATA } from '@/lib/mock-data'

export default async function EdicaoDeLayoutPage() {

  // TODO: substituir por fetch real → await fetch('/api/edicao-de-layout')
  const data = MOCK_DATA

  return (
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Edicao De Layout</h1>
          <p className="text-sm text-ink-faint mt-1">Editor visualiza o manuscrito renderizado página a página com os estilos aplicados. Ajusta tipografia, espaçamento e hierarquia de títulos em tempo real. Pode adicionar páginas em branco, inserir imagens e remover páginas. Confirma que o resultado visual está correto antes de exportar.</p>
        </div>
      </div>


  {/* Dados: {JSON.stringify(data, null, 2)} */}
      {/* TODO: implementar conteúdo — ver .build-plans/edicao-de-layout.plan.md */}
      <div className="glass rounded-card p-6">
        <p className="text-ink-soft text-sm">Tela em construção — ver build-plan.</p>
      </div>
    </div>
  )
}
