import { formatRelative } from '../format';

describe('formatRelative', () => {
  it('renvoie une chaîne vide pour une valeur vide', () => {
    expect(formatRelative('')).toBe('');
  });

  it('renvoie la valeur brute si elle n’est pas une date valide', () => {
    expect(formatRelative('Il y a 2 heures')).toBe('Il y a 2 heures');
  });

  it('affiche "À l’instant" pour une date très récente', () => {
    expect(formatRelative(new Date().toISOString())).toBe("À l'instant");
  });

  it('affiche les minutes pour une date il y a quelques minutes', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelative(d)).toBe('Il y a 5 min');
  });

  it('affiche les heures pour une date dans la journée', () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(d)).toBe('Il y a 3 h');
  });

  it('affiche "Hier" pour une date de la veille', () => {
    const d = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(d)).toBe('Hier');
  });
});
