// Upload — upload
// Objetivo: Editor nomeia o projeto e faz upload do manuscrito (DOCX ou Markdown). Ponto de entrada de dados no sistema.
// Build-plan: .build-plans/upload.plan.md
import { MOCK_DATA } from '@/lib/mock-data'

export default async function UploadPage() {

  // TODO: substituir por fetch real → await fetch('/api/upload')
  const data = MOCK_DATA

  return (
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Upload</h1>
          <p className="text-sm text-ink-faint mt-1">Editor nomeia o projeto e faz upload do manuscrito (DOCX ou Markdown). Ponto de entrada de dados no sistema.</p>
        </div>
      </div>


  {/* Dados: {JSON.stringify(data, null, 2)} */}
      {/* TODO: implementar conteúdo — ver .build-plans/upload.plan.md */}
      <div className="glass rounded-card p-6">
        <p className="text-ink-soft text-sm">Tela em construção — ver build-plan.</p>
      </div>
    </div>
  )
}
