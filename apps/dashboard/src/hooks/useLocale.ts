import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Keeps `<html lang>` and `<html dir>` in sync with the active language.
 *
 * This is one of the few legitimate `useEffect` uses in the app: the document
 * element is an external system the React tree does not own. Setting `dir`
 * here rather than on a page wrapper is also what makes portaled overlays
 * mirror — they render into `document.body`, outside the page tree.
 */
export function useLocale(): { language: string; direction: 'ltr' | 'rtl' } {
  const { i18n } = useTranslation();
  const direction = i18n.language.startsWith('ar') ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = direction;
  }, [i18n.language, direction]);

  return { language: i18n.language, direction };
}
