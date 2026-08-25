import { ProjEntity } from './proj.entity';

export interface PageRequest {
  readonly page: number;
  readonly size: number;
}

export interface ProjPage {
  readonly items: ProjEntity[];
  readonly total: number;
}

/**
 * Outbound port for PROJ persistence.
 *
 * The application layer depends on this interface only. The concrete Prisma
 * adapter is bound in `proj.module.ts`; swapping storage engines
 * must not require touching anything above this line.
 *
 * Every operation is scoped by empresa — there is no
 * cross-empresa read path by design.
 */
export interface ProjRepositoryPort {
  save(entity: ProjEntity, empresaId: string): Promise<ProjEntity>;

  findById(id: string, empresaId: string): Promise<ProjEntity | null>;

  findAll(page: PageRequest, empresaId: string): Promise<ProjPage>;

  deleteById(id: string, empresaId: string): Promise<void>;
}

/**
 * Injection token for ProjRepositoryPort.
 *
 * TypeScript interfaces are erased at runtime, so the port needs an explicit
 * token to be usable as a Nest provider key.
 */
export const ProjRepositoryPort = Symbol('ProjRepositoryPort');
