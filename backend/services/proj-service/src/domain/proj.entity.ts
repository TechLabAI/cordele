/**
 * Lifecycle status of a PROJ aggregate.
 */
export enum ProjStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export interface ProjProps {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: ProjStatus;
  readonly empresaId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * PROJ aggregate root — PROJ.
 *
 * Pure domain object: it knows its invariants and nothing about HTTP,
 * Prisma or Nest. Infrastructure converts to and from this shape through
 * the module mapper.
 */
export class ProjEntity {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: ProjStatus;
  /** Owning empresa; every query must be scoped by it. */
  readonly empresaId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ProjProps) {
    ProjEntity.assertInvariants(props);
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.status = props.status;
    this.empresaId = props.empresaId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Returns a copy with the given changes applied and `updatedAt` refreshed. */
  with(changes: Partial<Omit<ProjProps, 'id' | 'createdAt'>>): ProjEntity {
    return new ProjEntity({
      id: this.id,
      name: changes.name ?? this.name,
      description: changes.description ?? this.description,
      status: changes.status ?? this.status,
      empresaId: this.empresaId,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  isActive(): boolean {
    return this.status === ProjStatus.ACTIVE;
  }

  archive(): ProjEntity {
    return this.with({ status: ProjStatus.ARCHIVED });
  }

  private static assertInvariants(props: ProjProps): void {
    if (!props.id) {
      throw new Error('ProjEntity: id is required');
    }
    if (!props.name || props.name.trim().length < 2) {
      throw new Error('ProjEntity: name must have at least 2 characters');
    }
    if (!props.empresaId) {
      throw new Error('ProjEntity: empresa is required');
    }
  }
}
