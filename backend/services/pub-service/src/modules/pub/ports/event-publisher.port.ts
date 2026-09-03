/**
 * EventPublisherPort — minimal outbound port for in-process domain-event
 * dispatch from `PublicationBuildJob`.
 *
 * Intentionally technology-neutral: a simple Node.js `EventEmitter` wrapper
 * satisfies this interface in production; `jest.fn()` satisfies it in tests.
 *
 * RULE-04: lives in modules/ (application layer), never in infrastructure/.
 * RULE-01/02: no @nestjs/* or @prisma/client imports.
 *
 * The signature matches Node.js `EventEmitter.emit` so an adapter can be
 * wired without importing @nestjs/event-emitter (which is not in the service's
 * dependency manifest).
 */
export interface EventPublisherPort {
  /** Publishes `payload` under `event` key to all registered listeners. */
  emit(event: string, payload: unknown): boolean;
}

/**
 * DI token for EventPublisherPort.
 *
 * Same-name interface + Symbol pattern: TypeScript resolves the type from the
 * interface at compile time; NestJS resolves the provider from the Symbol at
 * runtime (interfaces compile to `undefined`, Symbols are stable values).
 */
export const EventPublisherPort = Symbol('EventPublisherPort');
