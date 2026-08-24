// Revisao De Estrutura — revisao-de-estrutura
// Objetivo: Exibe a estrutura detectada no manuscrito após o parsing. Editor confirma, ignora trechos não reconhecidos ou decide reimportar. Garante o princípio 2.1 (nada some sem aviso).
// Build-plan: .build-plans/revisao-de-estrutura.plan.md
import { MOCK_DATA } from '@/lib/mock-data'

export default async function RevisaoDeEstruturaPage() {

  // TODO: substituir por fetch real → await fetch('/api/revisao-de-estrutura')
  const data = MOCK_DATA

  return (
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Revisao De Estrutura</h1>
          <p className="text-sm text-ink-faint mt-1">Exibe a estrutura detectada no manuscrito após o parsing. Editor confirma, ignora trechos não reconhecidos ou decide reimportar. Garante o princípio 2.1 (nada some sem aviso).</p>
        </div>
      </div>


  {/* Dados: {JSON.stringify(data, null, 2)} */}
      {/* TODO: implementar conteúdo — ver .build-plans/revisao-de-estrutura.plan.md */}
      <div className="glass rounded-card p-6">
        <p className="text-ink-soft text-sm">Tela em construção — ver build-plan.</p>
      </div>
    </div>
  )
}
