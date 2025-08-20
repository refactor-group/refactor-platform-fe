import {
  createConnectedPresence,
  createDisconnectedPresence,
  toUserPresence,
  type UserPresence
} from '@/types/presence';

describe('Presence Types', () => {
  describe('createConnectedPresence', () => {
    it('creates a connected presence with correct properties', () => {
      const base = {
        userId: 'user1',
        name: 'John Doe',
        role: 'coach' as const,
        color: '#ffcc00'
      };

      const presence = createConnectedPresence(base);

      expect(presence.status).toBe('connected');
      expect(presence.isConnected).toBe(true);
      expect(presence.userId).toBe('user1');
      expect(presence.name).toBe('John Doe');
      expect(presence.role).toBe('coach');
      expect(presence.color).toBe('#ffcc00');
      expect(presence.lastSeen).toBeInstanceOf(Date);
    });

    it('creates presence for coachee role', () => {
      const base = {
        userId: 'user2',
        name: 'Jane Smith',
        role: 'coachee' as const,
        color: '#00ccff'
      };

      const presence = createConnectedPresence(base);

      expect(presence.role).toBe('coachee');
      expect(presence.status).toBe('connected');
    });
  });

  describe('createDisconnectedPresence', () => {
    it('converts connected presence to disconnected', () => {
      const connectedPresence = createConnectedPresence({
        userId: 'user1',
        name: 'John Doe',
        role: 'coach',
        color: '#ffcc00'
      });

      const disconnectedPresence = createDisconnectedPresence(connectedPresence);

      expect(disconnectedPresence.status).toBe('disconnected');
      expect(disconnectedPresence.isConnected).toBe(false);
      expect(disconnectedPresence.userId).toBe(connectedPresence.userId);
      expect(disconnectedPresence.name).toBe(connectedPresence.name);
      expect(disconnectedPresence.role).toBe(connectedPresence.role);
      expect(disconnectedPresence.color).toBe(connectedPresence.color);
      expect(disconnectedPresence.lastSeen).toBeInstanceOf(Date);
      expect(disconnectedPresence.lastSeen.getTime()).toBeGreaterThanOrEqual(
        connectedPresence.lastSeen.getTime()
      );
    });
  });

  describe('toUserPresence', () => {
    it('converts awareness data with isConnected: true to connected presence', () => {
      const awarenessData = {
        userId: 'user1',
        name: 'John Doe',
        role: 'coach',
        color: '#ffcc00',
        isConnected: true,
        lastSeen: new Date()
      };

      const presence = toUserPresence(awarenessData);

      expect(presence.status).toBe('connected');
      expect(presence.isConnected).toBe(true);
      expect(presence.userId).toBe('user1');
    });

    it('converts awareness data with isConnected: false to disconnected presence', () => {
      const awarenessData = {
        userId: 'user1',
        name: 'John Doe',
        role: 'coach',
        color: '#ffcc00',
        isConnected: false,
        lastSeen: new Date()
      };

      const presence = toUserPresence(awarenessData);

      expect(presence.status).toBe('disconnected');
      expect(presence.isConnected).toBe(false);
      expect(presence.userId).toBe('user1');
    });
  });
});