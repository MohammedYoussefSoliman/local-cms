import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * The dashboard's OWN chrome is translated here, from bundled files. It does
 * not eat its own dog food yet — bootstrapping the CMS from the CMS would make
 * the login screen unrenderable whenever the API is down.
 */
void i18n.use(initReactI18next).init({
  resources: {},
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'app',
  interpolation: { escapeValue: false },
});

export default i18n;
