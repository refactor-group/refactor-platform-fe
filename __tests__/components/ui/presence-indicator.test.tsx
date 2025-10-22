import { render, screen } from '@testing-library/react';
import { PresenceIndicator } from '@/components/ui/presence-indicator';
import { createConnectedPresence, createDisconnectedPresence } from '@/types/presence';
import { RelationshipRole } from '@/types/relationship-role';

describe('PresenceIndicator', () => {
  const mockConnectedPresence = createConnectedPresence({
    userId: 'user1',
    name: 'Test User',
    relationship_role: RelationshipRole.Coach,
    color: '#ffcc00'
  });

  const mockDisconnectedPresence = createDisconnectedPresence(mockConnectedPresence);

  it('renders green when user is connected', () => {
    render(<PresenceIndicator presence={mockConnectedPresence} />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-green-500');
    expect(indicator).toHaveAttribute('aria-label', 'Online');
  });

  it('renders gray when user is disconnected', () => {
    render(<PresenceIndicator presence={mockDisconnectedPresence} />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-gray-900');
    expect(indicator).toHaveAttribute('aria-label', 'Offline');
  });

  it('renders gray when presence is undefined', () => {
    render(<PresenceIndicator presence={undefined} />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-gray-900');
    expect(indicator).toHaveAttribute('aria-label', 'Offline');
  });
});