import React from 'react';
import { Alert } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { DialogProvider, useDialog } from '../DialogContext';

// Par défaut jest-expo simule iOS → les méthodes délèguent à Alert natif.

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DialogProvider>{children}</DialogProvider>
);

describe('DialogContext (mobile natif)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('confirm délègue à Alert.alert avec annuler + confirmer', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onConfirm = jest.fn();
    const { result } = renderHook(() => useDialog(), { wrapper });

    result.current.confirm({
      title: 'Déconnexion',
      message: 'Sûr ?',
      confirmText: 'Se déconnecter',
      destructive: true,
      onConfirm,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = spy.mock.calls[0];
    expect(title).toBe('Déconnexion');
    expect(message).toBe('Sûr ?');
    expect(buttons).toHaveLength(2);
    expect(buttons?.[0]).toMatchObject({ style: 'cancel' });
    expect(buttons?.[1]).toMatchObject({ text: 'Se déconnecter', style: 'destructive' });
    buttons?.[1].onPress?.();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('choose ajoute un bouton Annuler après les choix', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useDialog(), { wrapper });

    result.current.choose({
      title: 'Apparence',
      choices: [
        { text: 'Clair' },
        { text: 'Sombre' },
        { text: 'Système' },
      ],
    });

    const buttons = spy.mock.calls[0][2];
    expect(buttons).toHaveLength(4);
    expect(buttons?.[0]).toMatchObject({ text: 'Annuler', style: 'cancel' });
    expect(buttons?.map((b) => b.text)).toEqual(['Annuler', 'Clair', 'Sombre', 'Système']);
  });

  it('prompt délègue à Alert.prompt sur iOS', () => {
    const spy = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
    const onSubmit = jest.fn();
    const { result } = renderHook(() => useDialog(), { wrapper });

    result.current.prompt({
      title: 'Téléphone',
      defaultValue: '06',
      onSubmit,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('Téléphone');
  });
});
