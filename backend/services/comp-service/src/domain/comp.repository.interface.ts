import { CompEntity } from './comp.entity';

export interface PageRequest {
  readonly page: number;
  readonly size: number;
}

export interface CompPage {
  readonly items: CompEntity[];
  readonly total: number;
}

/**
 * Outbound port for COMP persistence.
 *
 * The application layer depends on this interface only. The concrete Prisma
 * adapter is bound in `comp.module.ts`; swapping storage engines
 * must not require touching anything above this line.
 *
 * Every operation is scoped by empresa — there is no
 * cross-empresa read path by design.
 */
export interface CompRepositoryPort {
  save(entity: CompEntity, empresaId: string): Promise<CompEntity>;

  findById(id: string, empresaId: string): Promise<CompEntity | null>;

  findAll(page: PageRequest, empresaId: string): Promise<CompPage>;

  deleteById(id: string, empresaId: string): Promise<void>;
}

/**
 * Injection token for CompRepositoryPort.
 *
 * TypeScript interfaces are erased at runtime, so the port needs an explicit
 * token to be usable as a Nest provider key.
 */
export const CompRepositoryPort = Symbol('CompRepositoryPort');
