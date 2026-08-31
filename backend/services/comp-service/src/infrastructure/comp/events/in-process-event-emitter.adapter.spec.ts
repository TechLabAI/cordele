import { InProcessEventEmitterAdapter } from './in-process-event-emitter.adapter';

/**
 * Unit tests for InProcessEventEmitterAdapter.
 *
 * These specs verify the core contract of the DomainEventEmitter port:
 *  - emit() calls every registered listener with the correct payload.
 *  - Multiple listeners on the same event name are all called.
 *  - A listener that throws does NOT prevent subsequent listeners from running.
 *  - Listeners registered for a different event name are NOT called.
 *
 * No NestJS TestingModule is needed — the adapter has no external deps.
 */
describe('InProcessEventEmitterAdapter', () => {
  let adapter: InProcessEventEmitterAdapter;

  beforeEach(() => {
    adapter = new InProcessEventEmitterAdapter();
  });

  describe('emit()', () => {
    it('should call the registered listener with the correct payload', () => {
      const listener = jest.fn();
      const payload = { projetoId: 'proj-1', titulo: 'New title' };

      adapter.on('MetadataUpdated', listener);
      adapter.emit('MetadataUpdated', payload);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(payload);
    });

    it('should call all listeners when multiple listeners are registered for the same event', () => {
      const listenerA = jest.fn();
      const listenerB = jest.fn();
      const listenerC = jest.fn();
      const payload = { projetoId: 'proj-2' };

      adapter.on('LayoutUpdated', listenerA);
      adapter.on('LayoutUpdated', listenerB);
      adapter.on('LayoutUpdated', listenerC);
      adapter.emit('LayoutUpdated', payload);

      expect(listenerA).toHaveBeenCalledWith(payload);
      expect(listenerB).toHaveBeenCalledWith(payload);
      expect(listenerC).toHaveBeenCalledWith(payload);
    });

    it('should NOT call listeners registered for a different event name', () => {
      const metadataListener = jest.fn();
      const layoutListener = jest.fn();

      adapter.on('MetadataUpdated', metadataListener);
      adapter.on('LayoutUpdated', layoutListener);

      adapter.emit('MetadataUpdated', { projetoId: 'proj-3' });

      expect(metadataListener).toHaveBeenCalledTimes(1);
      expect(layoutListener).not.toHaveBeenCalled();
    });

    it('should continue calling subsequent listeners even if one throws', () => {
      const throwingListener = jest.fn().mockImplementation(() => {
        throw new Error('listener error');
      });
      const safeListener = jest.fn();
      const payload = { projetoId: 'proj-4' };

      adapter.on('MetadataUpdated', throwingListener);
      adapter.on('MetadataUpdated', safeListener);

      // Should not throw — errors are swallowed by the adapter.
      expect(() => adapter.emit('MetadataUpdated', payload)).not.toThrow();
      expect(throwingListener).toHaveBeenCalledWith(payload);
      expect(safeListener).toHaveBeenCalledWith(payload);
    });

    it('should do nothing when no listeners are registered for the event', () => {
      expect(() =>
        adapter.emit('UnknownEvent', { projetoId: 'proj-5' }),
      ).not.toThrow();
    });
  });

  describe('on() / off()', () => {
    it('should stop calling a listener after off() is called', () => {
      const listener = jest.fn();
      const payload = { projetoId: 'proj-6' };

      adapter.on('MetadataUpdated', listener);
      adapter.off('MetadataUpdated', listener);
      adapter.emit('MetadataUpdated', payload);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount()', () => {
    it('should return 0 when no listeners are registered', () => {
      expect(adapter.listenerCount('MetadataUpdated')).toBe(0);
    });

    it('should return the correct count after registering multiple listeners', () => {
      adapter.on('LayoutUpdated', jest.fn());
      adapter.on('LayoutUpdated', jest.fn());

      expect(adapter.listenerCount('LayoutUpdated')).toBe(2);
    });

    it('should decrease after off() removes a listener', () => {
      const listener = jest.fn();
      adapter.on('MetadataUpdated', listener);
      adapter.off('MetadataUpdated', listener);

      expect(adapter.listenerCount('MetadataUpdated')).toBe(0);
    });
  });
});
