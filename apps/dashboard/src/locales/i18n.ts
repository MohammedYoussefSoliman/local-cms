import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * The dashboard's OWN chrome is translated here, from bundled files. It does
 * not eat its own dog food — bootstrapping the CMS UI from the CMS would make
 * the login screen unrenderable whenever the API is down.
 *
 * Arabic is the default because that is how the product was designed: the CMS
 * is operated by an Arabic-speaking content team, and `useLocale` flips
 * `<html dir>` to match. English is complete and one click away.
 */
const STORAGE_KEY = 'cms-dashboard-language';

function initialLanguage(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? 'ar';
  } catch {
    // Private mode, blocked site data — the default is still correct.
    return 'ar';
  }
}

void i18n.use(initReactI18next).init({
  resources: {},
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['ar', 'en'],
  defaultNS: 'app',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (language) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // A remembered language is a convenience, never a correctness requirement.
  }
});

export default i18n;
