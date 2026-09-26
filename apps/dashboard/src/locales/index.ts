import './ar';
import './en';

// Feature modules register their own namespaces. Imported here rather than
// lazily from each page so a bundle is never rendered before its strings land
// — a missing namespace renders the key, silently.
import '@/modules/apps/locales';
import '@/modules/auth/locales';
import '@/modules/drafts/locales';
import '@/modules/locales/locales';
import '@/modules/overview/locales';
import '@/modules/translations/locales';
import '@/modules/users/locales';

export { default as i18n } from './i18n';
