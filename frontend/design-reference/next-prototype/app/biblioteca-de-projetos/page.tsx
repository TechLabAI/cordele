// Biblioteca De Projetos — biblioteca-de-projetos
// Objetivo: Lista todos os projetos editoriais da editora. Ponto de partida para retomar projetos existentes ou iniciar um novo.
// Build-plan: .build-plans/biblioteca-de-projetos.plan.md
import { MOCK_DATA } from '@/lib/mock-data'

export default async function BibliotecaDeProjetosPage() {

  // TODO: substituir por fetch real → await fetch('/api/biblioteca-de-projetos')
  const data = MOCK_DATA

  return (
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Biblioteca De Projetos</h1>
          <p className="text-sm text-ink-faint mt-1">Lista todos os projetos editoriais da editora. Ponto de partida para retomar projetos existentes ou iniciar um novo.</p>
        </div>
      </div>


  {/* Dados: {JSON.stringify(data, null, 2)} */}
      {/* TODO: implementar conteúdo — ver .build-plans/biblioteca-de-projetos.plan.md */}
      <div className="glass rounded-card p-6">
        <p className="text-ink-soft text-sm">Tela em construção — ver build-plan.</p>
      </div>
    </div>
  )
}
