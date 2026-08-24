// Download E Historico — download-e-historico
// Objetivo: Confirmação de download e histórico de exportações do projeto. Editor pode baixar versões anteriores ou iniciar nova exportação após ajustes.
// Build-plan: .build-plans/download-e-historico.plan.md
import { MOCK_DATA } from '@/lib/mock-data'

export default async function DownloadEHistoricoPage() {

  // TODO: substituir por fetch real → await fetch('/api/download-e-historico')
  const data = MOCK_DATA

  return (
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Download E Historico</h1>
          <p className="text-sm text-ink-faint mt-1">Confirmação de download e histórico de exportações do projeto. Editor pode baixar versões anteriores ou iniciar nova exportação após ajustes.</p>
        </div>
      </div>


  {/* Dados: {JSON.stringify(data, null, 2)} */}
      {/* TODO: implementar conteúdo — ver .build-plans/download-e-historico.plan.md */}
      <div className="glass rounded-card p-6">
        <p className="text-ink-soft text-sm">Tela em construção — ver build-plan.</p>
      </div>
    </div>
  )
}
