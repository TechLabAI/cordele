import { EventEmitter } from 'events';
import { Injectable, Logger } from '@nestjs/common';
import type { DomainEventEmitter } from '../../../modules/comp/ports/domain-event-emitter.port';

/**
 * In-process implementation of DomainEventEmitter for the COMP bounded context.
 *
 * Dispatches domain events synchronously via Node's built-in `EventEmitter`.
 * Every listener registered for a given event name is called with the payload.
 * Listener errors are caught and logged — they never propagate to the caller.
 *
 * This adapter satisfies the pre-requisite for COMP-004 (MetadataUpdated),
 * COMP-005 (UploadCapa) and COMP-007 (LayoutUpdated). Use cases emit through
 * the `COMP_EVENT_EMITTER` token and are completely decoupled from the
 * transport (in-process today; a broker adapter can replace this class
 * by swapping the token binding in AppModule without touching any use case).
 *
 * messaging.enabled=false in the current deployment — no Kafka / RabbitMQ.
 *
 * RULE-05: infrastructure/ does not import modules/; the import here is for
 *          the port interface only (type-level, no runtime dependency on modules/).
 * RULE-08: no console.log — uses NestJS Logger.
 */
@Injectable()
export class InProcessEventEmitterAdapter implements DomainEventEmitter {
  private readonly logger = new Logger(InProcessEventEmitterAdapter.name);
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Raise the default listener limit so multiple use cases can subscribe
    // to the same event name without triggering a Node memory-leak warning.
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a domain event.
   *
   * All listeners registered via `on()` for `eventName` are called
   * synchronously. Any error thrown by a listener is caught and logged
   * without propagating to the caller.
   */
  emit(eventName: string, payload: Record<string, unknown>): void {
    this.logger.debug(
      `Emitting domain event: ${eventName} — payload keys: [${Object.keys(payload).join(', ')}]`,
    );

    const listeners = this.emitter.listeners(eventName) as Array<
      (p: Record<string, unknown>) => void
    >;

    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (err) {
        this.logger.error(
          `Listener error for event "${eventName}": ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }
  }

  /**
   * Register a listener for a domain event.
   *
   * Exposed so that other infrastructure adapters or test helpers can
   * subscribe to events without depending on the concrete EventEmitter type.
   */
  on(eventName: string, listener: (payload: Record<string, unknown>) => void): void {
    this.emitter.on(eventName, listener);
  }

  /**
   * Remove a previously registered listener.
   */
  off(eventName: string, listener: (payload: Record<string, unknown>) => void): void {
    this.emitter.off(eventName, listener);
  }

  /**
   * Return the number of listeners currently registered for `eventName`.
   * Used in tests to assert correct wiring without triggering a real emit.
   */
  listenerCount(eventName: string): number {
    return this.emitter.listenerCount(eventName);
  }
}
