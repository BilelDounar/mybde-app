import { StyleSheet, Text, type TextProps } from 'react-native';

import { interForWeight } from '@/constants/theme';

type TextRender = (this: unknown, ...args: unknown[]) => React.ReactElement<TextProps>;

let installed = false;

/**
 * Applique Inter (à la bonne graisse) comme police par défaut de tout `Text`.
 * Les styles qui définissent déjà `fontFamily` (ex. titres Space Grotesk) sont
 * laissés intacts. À appeler une seule fois au démarrage de l'app.
 */
export function installGlobalFont() {
  if (installed) return;
  installed = true;

  const TextAny = Text as unknown as { render?: TextRender };
  const originalRender = TextAny.render;
  if (!originalRender) return;

  TextAny.render = function patchedRender(...args: unknown[]) {
    const element = originalRender.apply(this, args);
    const flattened = StyleSheet.flatten(element.props.style) ?? {};
    if (flattened.fontFamily) return element;

    return {
      ...element,
      props: {
        ...element.props,
        style: [{ fontFamily: interForWeight(flattened.fontWeight) }, element.props.style],
      },
    };
  };
}
