// Exportacao E Validacao — exportacao-e-validacao
// Objetivo: Exibe o processo de geração do ePub e o resultado da validação epubcheck. Se válido: libera download. Se com erros: exibe lista com localização e orientação de correção.
// Build-plan: .build-plans/exportacao-e-validacao.plan.md
import { MOCK_DATA } from '@/lib/mock-data'

export default async function ExportacaoEValidacaoPage() {

  // TODO: substituir por fetch real → await fetch('/api/exportacao-e-validacao')
  const data = MOCK_DATA

  return (
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Exportacao E Validacao</h1>
          <p className="text-sm text-ink-faint mt-1">Exibe o processo de geração do ePub e o resultado da validação epubcheck. Se válido: libera download. Se com erros: exibe lista com localização e orientação de correção.</p>
        </div>
      </div>


  {/* Dados: {JSON.stringify(data, null, 2)} */}
      {/* TODO: implementar conteúdo — ver .build-plans/exportacao-e-validacao.plan.md */}
      <div className="glass rounded-card p-6">
        <p className="text-ink-soft text-sm">Tela em construção — ver build-plan.</p>
      </div>
    </div>
  )
}
