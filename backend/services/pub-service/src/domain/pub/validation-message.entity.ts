import { ValidationSeverity } from './validation-severity.enum';

export interface ValidationMessageProps {
  readonly id: string;
  readonly publicacaoId: string;
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly location?: string;
  readonly ordem: number;
  readonly criadoEm: Date;
}

/**
 * One epubcheck report line (`validation_message`, data-model.md §2.2).
 *
 * Pure domain object — child of the `Publicacao` aggregate, persisted for
 * auditability of why a build was rejected or warned.
 */
export class ValidationMessageEntity {
  readonly id: string;
  readonly publicacaoId: string;
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly location?: string;
  readonly ordem: number;
  readonly criadoEm: Date;

  constructor(props: ValidationMessageProps) {
    ValidationMessageEntity.assertInvariants(props);
    this.id = props.id;
    this.publicacaoId = props.publicacaoId;
    this.severity = props.severity;
    this.code = props.code;
    this.message = props.message;
    this.location = props.location;
    this.ordem = props.ordem;
    this.criadoEm = props.criadoEm;
  }

  private static assertInvariants(props: ValidationMessageProps): void {
    if (!props.id) {
      throw new Error('ValidationMessageEntity: id is required');
    }
    if (!props.publicacaoId) {
      throw new Error('ValidationMessageEntity: publicacaoId is required');
    }
    if (!props.code) {
      throw new Error('ValidationMessageEntity: code is required');
    }
    if (!props.message) {
      throw new Error('ValidationMessageEntity: message is required');
    }
    if (props.ordem < 0) {
      throw new Error('ValidationMessageEntity: ordem must be >= 0');
    }
  }
}
