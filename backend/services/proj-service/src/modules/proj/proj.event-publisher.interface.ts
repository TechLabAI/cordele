/**
 * Minimal event-publishing port for the PROJ bounded context.
 *
 * Decouples use cases from the concrete EventEmitter2 implementation so that
 * unit tests can inject a jest.fn() mock and verify publish calls without
 * needing @nestjs/event-emitter to be configured.
 *
 * The real binding (EventEmitter2 from @nestjs/event-emitter or an equivalent)
 * is wired in proj.module.ts.
 *
 * RULE-04: this file is in modules/ — it does not import from infrastructure/.
 */
export interface IProjectEventPublisher {
  /**
   * Publishes a domain event by name.
   *
   * The event is fire-and-forget: listeners run asynchronously outside the
   * originating transaction (api-contract §7 / SPEC-05).
   *
   * @param eventName  - discriminator used by listeners (e.g. 'ProjectCreated')
   * @param payload    - the domain event object
   */
  publish(eventName: string, payload: unknown): void;
}
