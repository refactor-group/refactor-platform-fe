import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePathname, useRouter } from 'next/navigation';
import { UserMenu } from '@/components/ui/user-menu';
import { Role, type UserRoleState } from '@/types/user';

const h = vi.hoisted(() => ({
  isACoach: false,
  isSuperAdmin: false,
  currentOrganizationId: 'org-1' as string | null,
  roleState: {} as UserRoleState,
  theme: 'light',
  setTheme: vi.fn(),
  logout: vi.fn(),
  setCurrentOrganizationId: vi.fn(),
  rememberOrganizationForUser: vi.fn(),
}));

vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      userId: 'user-1',
      isACoach: h.isACoach,
      userSession: {
        id: 'user-1',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        roles: [],
      },
    }),
}));

vi.mock('@/lib/api/organizations', () => ({
  useOrganizationList: () => ({
    organizations: [
      { id: 'org-1', name: 'Acme Corp', logo: null },
      { id: 'org-2', name: 'Beta Inc', logo: null },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/lib/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: h.currentOrganizationId,
    setCurrentOrganizationId: h.setCurrentOrganizationId,
    rememberOrganizationForUser: h.rememberOrganizationForUser,
  }),
}));

vi.mock('@/lib/hooks/use-current-user-role', () => ({
  useCurrentUserRole: () => h.roleState,
}));
vi.mock('@/lib/hooks/use-is-super-admin', () => ({
  useIsSuperAdmin: () => h.isSuperAdmin,
}));
vi.mock('@/lib/hooks/use-logout-user', () => ({
  useLogoutUser: () => h.logout,
}));
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: h.theme, setTheme: h.setTheme }),
}));

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

const roleState = (role: Role): UserRoleState => ({ status: 'success', role, hasAccess: true });

async function openMenu() {
  const user = userEvent.setup();
  render(<UserMenu />);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));
  const menu = await screen.findByRole('menu');
  return { user, menu };
}

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isACoach = false;
    h.isSuperAdmin = false;
    h.currentOrganizationId = 'org-1';
    h.roleState = roleState(Role.Admin);
    h.theme = 'light';
    vi.mocked(usePathname).mockReturnValue('/');
  });

  it('shows the account name and email', async () => {
    const { menu } = await openMenu();

    expect(within(menu).getByText('Test User')).toBeInTheDocument();
    expect(within(menu).getByText('test@example.com')).toBeInTheDocument();
  });

  describe('Members', () => {
    it('is shown to an org admin and links to the current org', async () => {
      const { menu } = await openMenu();

      expect(within(menu).getByRole('menuitem', { name: 'Members' })).toHaveAttribute(
        'href',
        '/organizations/org-1/members'
      );
    });

    it('is hidden for a regular user', async () => {
      h.roleState = roleState(Role.User);
      const { menu } = await openMenu();

      expect(within(menu).queryByRole('menuitem', { name: 'Members' })).not.toBeInTheDocument();
    });

    it('is hidden when no organization is selected', async () => {
      h.currentOrganizationId = null;
      h.isSuperAdmin = true;
      const { menu } = await openMenu();

      expect(within(menu).queryByRole('menuitem', { name: 'Members' })).not.toBeInTheDocument();
    });
  });

  it('shows Organizations only to super admins', async () => {
    const { menu } = await openMenu();
    expect(within(menu).queryByRole('menuitem', { name: 'Organizations' })).not.toBeInTheDocument();
  });

  it('links Organizations to the admin page for super admins', async () => {
    h.isSuperAdmin = true;
    const { menu } = await openMenu();

    expect(within(menu).getByRole('menuitem', { name: 'Organizations' })).toHaveAttribute(
      'href',
      '/admin/organizations'
    );
  });

  it('shows Settings only to coaches', async () => {
    const { menu } = await openMenu();
    expect(within(menu).queryByRole('menuitem', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('shows Settings to a coach', async () => {
    h.isACoach = true;
    const { menu } = await openMenu();

    expect(within(menu).getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('has no Referrals link and no shortcut hints', async () => {
    h.isACoach = true;
    h.isSuperAdmin = true;
    const { menu } = await openMenu();

    expect(within(menu).queryByText(/referrals/i)).not.toBeInTheDocument();
    expect(menu.textContent).not.toMatch(/⌘|⇧/);
  });

  describe('Appearance', () => {
    it('offers Light, Dark and Auto with Auto checked for the system theme', async () => {
      h.theme = 'system';
      const { menu } = await openMenu();

      const radios = within(menu).getAllByRole('menuitemradio');
      expect(radios.map((radio) => radio.textContent)).toEqual(['Light', 'Dark', 'Auto']);
      expect(within(menu).getByRole('menuitemradio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
      expect(within(menu).getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
    });

    it('switches to Dark and keeps the menu open', async () => {
      const { user, menu } = await openMenu();

      await user.click(within(menu).getByRole('menuitemradio', { name: 'Dark' }));

      expect(h.setTheme).toHaveBeenCalledWith('dark');
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  it('logs out', async () => {
    const { user, menu } = await openMenu();

    await user.click(within(menu).getByRole('menuitem', { name: 'Log out' }));

    expect(h.logout).toHaveBeenCalledTimes(1);
  });

  describe('switching organization', () => {
    function mockRoute(pathname: string) {
      const push = vi.fn();
      vi.mocked(usePathname).mockReturnValue(pathname);
      vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
      return push;
    }

    it('stays on the same org-scoped page for the new organization', async () => {
      const push = mockRoute('/organizations/org-1/members');
      const { user, menu } = await openMenu();

      await user.click(within(menu).getByRole('menuitem', { name: /Beta Inc/ }));

      expect(h.setCurrentOrganizationId).toHaveBeenCalledWith('org-2');
      expect(h.rememberOrganizationForUser).toHaveBeenCalledWith('user-1', 'org-2');
      expect(push).toHaveBeenCalledWith('/organizations/org-2/members');
    });

    it('goes to the dashboard from a page outside any organization', async () => {
      const push = mockRoute('/actions');
      const { user, menu } = await openMenu();

      await user.click(within(menu).getByRole('menuitem', { name: /Beta Inc/ }));

      expect(push).toHaveBeenCalledWith('/dashboard');
    });

    it('closes the menu after switching', async () => {
      mockRoute('/dashboard');
      const { user, menu } = await openMenu();

      await user.click(within(menu).getByRole('menuitem', { name: /Beta Inc/ }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});
