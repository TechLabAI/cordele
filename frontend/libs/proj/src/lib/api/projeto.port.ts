/**
 * projeto.port.ts — Port interface for the Projeto resource.
 * Covers api-contract §4.1–4.3, §4.6, §4.7:
 *   POST   /api/proj/projetos                          → create (T02 "Novo projeto")
 *   GET    /api/proj/projetos                          → list (T02 library)
 *   GET    /api/proj/projetos/{projetoId}              → get (T08 header detail)
 *   POST   /api/proj/projetos/{projetoId}/reopen       → reopen (T08 "Ajustar metadados/layout")
 *   DELETE /api/proj/projetos/{projetoId}              → delete (LGPD — UI deferred, port present)
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CriarProjetoRequest,
  ProjetoCard,
  ProjetoDetail,
} from '../models/proj.models';

export interface ProjetoPort {
  /** GET /api/proj/projetos — list library cards (newest activity first). */
  list(params?: { status?: string }): Observable<ProjetoCard[]>;

  /** GET /api/proj/projetos/{projetoId} — full project detail (T08 header + history). */
  get(projetoId: string): Observable<ProjetoDetail>;

  /** POST /api/proj/projetos — create a new project in status rascunho. */
  create(req: CriarProjetoRequest): Observable<ProjetoDetail>;

  /**
   * POST /api/proj/projetos/{projetoId}/reopen — return publicado/com_erros → em_composicao.
   * api-contract §4.7: returns ProjetoDetail (updated status).
   * 409 if project is in rascunho (illegal); 200 with changed=false if already em_composicao.
   */
  reopen(projetoId: string): Observable<ProjetoDetail>;

  /** DELETE /api/proj/projetos/{projetoId} — LGPD erasure. UI deferred but port present. */
  delete(projetoId: string): Observable<void>;
}

export const PROJETO_PORT = new InjectionToken<ProjetoPort>('ProjetoPort');
