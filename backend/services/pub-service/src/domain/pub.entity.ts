/**
 * Lifecycle status of a PUB aggregate.
 */
export enum PubStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export interface PubProps {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: PubStatus;
  readonly empresaId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * PUB aggregate root — PUB.
 *
 * Pure domain object: it knows its invariants and nothing about HTTP,
 * Prisma or Nest. Infrastructure converts to and from this shape through
 * the module mapper.
 */
export class PubEntity {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: PubStatus;
  /** Owning empresa; every query must be scoped by it. */
  readonly empresaId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PubProps) {
    PubEntity.assertInvariants(props);
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.status = props.status;
    this.empresaId = props.empresaId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Returns a copy with the given changes applied and `updatedAt` refreshed. */
  with(changes: Partial<Omit<PubProps, 'id' | 'createdAt'>>): PubEntity {
    return new PubEntity({
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
    return this.status === PubStatus.ACTIVE;
  }

  archive(): PubEntity {
    return this.with({ status: PubStatus.ARCHIVED });
  }

  private static assertInvariants(props: PubProps): void {
    if (!props.id) {
      throw new Error('PubEntity: id is required');
    }
    if (!props.name || props.name.trim().length < 2) {
      throw new Error('PubEntity: name must have at least 2 characters');
    }
    if (!props.empresaId) {
      throw new Error('PubEntity: empresa is required');
    }
  }
}
