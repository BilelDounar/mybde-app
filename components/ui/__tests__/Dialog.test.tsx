import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Dialog } from '../Dialog';

describe('Dialog', () => {
  it('affiche le titre, le message et les boutons', () => {
    const { getByText } = render(
      <Dialog
        visible
        title="Titre"
        message="Message de test"
        buttons={[{ text: 'OK' }]}
        onDismiss={() => {}}
      />,
    );
    expect(getByText('Titre')).toBeTruthy();
    expect(getByText('Message de test')).toBeTruthy();
    expect(getByText('OK')).toBeTruthy();
  });

  it('appelle onPress du bouton avec la valeur saisie', () => {
    const onPress = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <Dialog
        visible
        title="Saisie"
        showInput
        inputPlaceholder="Entrez une valeur"
        buttons={[{ text: 'Valider', onPress }]}
        onDismiss={() => {}}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('Entrez une valeur'), 'coucou');
    fireEvent.press(getByText('Valider'));

    expect(onPress).toHaveBeenCalledWith('coucou');
  });

  it('initialise le champ avec la valeur par défaut', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Dialog
        visible
        title="Saisie"
        showInput
        inputDefaultValue="défaut"
        buttons={[{ text: 'Valider', onPress }]}
        onDismiss={() => {}}
      />,
    );

    fireEvent.press(getByText('Valider'));
    expect(onPress).toHaveBeenCalledWith('défaut');
  });
});
