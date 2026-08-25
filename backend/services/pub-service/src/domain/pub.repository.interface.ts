import { PubEntity } from './pub.entity';

export interface PageRequest {
  readonly page: number;
  readonly size: number;
}

export interface PubPage {
  readonly items: PubEntity[];
  readonly total: number;
}

/**
 * Outbound port for PUB persistence.
 *
 * The application layer depends on this interface only. The concrete Prisma
 * adapter is bound in `pub.module.ts`; swapping storage engines
 * must not require touching anything above this line.
 *
 * Every operation is scoped by empresa — there is no
 * cross-empresa read path by design.
 */
export interface PubRepositoryPort {
  save(entity: PubEntity, empresaId: string): Promise<PubEntity>;

  findById(id: string, empresaId: string): Promise<PubEntity | null>;

  findAll(page: PageRequest, empresaId: string): Promise<PubPage>;

  deleteById(id: string, empresaId: string): Promise<void>;
}

/**
 * Injection token for PubRepositoryPort.
 *
 * TypeScript interfaces are erased at runtime, so the port needs an explicit
 * token to be usable as a Nest provider key.
 */
export const PubRepositoryPort = Symbol('PubRepositoryPort');
