import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SidebarTabBar } from '../SidebarTabBar';
import { TransitionProvider } from '@/context/TransitionContext';
import { AuthProvider } from '@/context/AuthContext';

// Props réelles attendues par le composant : évite de « spread » un `never`
// (les mocks ci-dessous sont partiels, castés via `unknown`).
type SidebarTabBarProps = React.ComponentProps<typeof SidebarTabBar>;

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <TransitionProvider>{ui}</TransitionProvider>
    </AuthProvider>,
  );
}

function makeProps(activeIndex: number, emit = jest.fn(() => ({ defaultPrevented: false })), dispatch = jest.fn()) {
  const routes = [
    { key: 'index-1', name: 'index' },
    { key: 'events-1', name: 'events' },
  ];
  const descriptors = {
    'index-1': {
      options: {
        title: 'Accueil',
        tabBarIcon: () => <Text>icon-accueil</Text>,
      },
    },
    'events-1': {
      options: {
        title: 'Événements',
        tabBarIcon: () => <Text>icon-events</Text>,
      },
    },
  };
  return {
    state: { index: activeIndex, key: 'tab-stack', routes },
    descriptors,
    navigation: { emit, dispatch },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  } as unknown as SidebarTabBarProps;
}

describe('SidebarTabBar', () => {
  it('rend la marque et un élément par route', () => {
    const { getByText } = renderWithProviders(<SidebarTabBar {...makeProps(0)} />);
    expect(getByText('MyBDE')).toBeTruthy();
    expect(getByText('Accueil')).toBeTruthy();
    expect(getByText('Événements')).toBeTruthy();
  });

  it('navigue vers la route non active au clic', () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const dispatch = jest.fn();
    const { getByText } = renderWithProviders(<SidebarTabBar {...makeProps(0, emit, dispatch)} />);

    fireEvent.press(getByText('Événements'));

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'events-1' }),
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('ne navigue pas quand la route est déjà active', () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const dispatch = jest.fn();
    const { getByText } = renderWithProviders(<SidebarTabBar {...makeProps(0, emit, dispatch)} />);

    fireEvent.press(getByText('Accueil'));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('masque un onglet désactivé (href: null → tabBarItemStyle display none)', () => {
    const props = makeProps(0) as unknown as {
      state: { routes: { key: string; name: string }[] };
      descriptors: Record<string, { options: Record<string, unknown> }>;
    };
    props.state.routes.push({ key: 'manage-1', name: 'manage' });
    props.descriptors['manage-1'] = {
      options: { title: 'Gestion', tabBarItemStyle: { display: 'none' } },
    };

    const { queryByText } = renderWithProviders(<SidebarTabBar {...(props as unknown as SidebarTabBarProps)} />);

    expect(queryByText('Gestion')).toBeNull();
    expect(queryByText('Accueil')).toBeTruthy();
  });
});
