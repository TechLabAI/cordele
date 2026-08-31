import { Injectable, Logger } from '@nestjs/common';

/**
 * Application service for the COMP bounded context.
 *
 * In P1 this is a structural placeholder retained for module wiring.
 * Real use cases are introduced as separate `*.use-case.ts` files in P2
 * (COMP-003..COMP-008), each injected by its DI token from `comp.tokens.ts`.
 *
 * The controller (P1) injects use cases by token directly — this service
 * is no longer the single orchestrator; it will be removed or repurposed
 * as a thin coordinator if needed in a later priority.
 */
@Injectable()
export class CompService {
  private readonly logger = new Logger(CompService.name);

  constructor() {
    this.logger.log('CompService initialised (P1 placeholder — use cases wired in P2)');
  }
}
