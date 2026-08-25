import { randomUUID } from 'node:crypto';

import { CompEntity, CompStatus } from './comp.entity';

export interface CreateCompCommand {
  readonly name: string;
  readonly description?: string;
  readonly status?: CompStatus;
  readonly empresaId: string;
}

export interface ChangeCompCommand {
  readonly name?: string;
  readonly description?: string;
  readonly status?: CompStatus;
}

/**
 * Domain service for COMP (COMP).
 *
 * Holds the business rules that do not belong to a single entity instance:
 * construction policies, cross-field validation and state transitions. It is
 *
 * D-603: this class carries NO Nest decorator. ADR-001-hexagonal-node rule 7
 * requires that `src/domain/` import neither `@nestjs/*` nor `@prisma/client`,
 * and the `@Injectable()` that used to sit here — added "for convenience" —
 * broke exactly that rule. The module registers it with a factory instead, so
 * the domain stays testable without booting the framework.
 */
export class CompDomainService {
  /** Materializes a brand new aggregate from a validated command. */
  createFrom(command: CreateCompCommand): CompEntity {
    const now = new Date();
    return new CompEntity({
      id: randomUUID(),
      name: command.name.trim(),
      description: command.description?.trim(),
      status: command.status ?? CompStatus.ACTIVE,
      empresaId: command.empresaId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Applies a partial change set, enforcing the allowed status transitions. */
  applyChanges(current: CompEntity, command: ChangeCompCommand): CompEntity {
    if (command.status && !this.canTransition(current.status, command.status)) {
      throw new Error(
        `CompDomainService: illegal transition ${current.status} -> ${command.status}`,
      );
    }

    return current.with({
      name: command.name?.trim(),
      description: command.description?.trim(),
      status: command.status,
    });
  }

  /** ARCHIVED is terminal; ACTIVE and INACTIVE toggle freely. */
  canTransition(from: CompStatus, to: CompStatus): boolean {
    if (from === to) {
      return true;
    }
    return from !== CompStatus.ARCHIVED;
  }
}
