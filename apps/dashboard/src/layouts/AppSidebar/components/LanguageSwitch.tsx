import { SegmentedControl, SegmentedControlGroup } from '@cms/ui';
import { useTranslation } from 'react-i18next';


/**
 * Switches the DASHBOARD's own language — not the content languages the CMS
 * manages. `useLocale` picks the change up and flips `<html dir>`, which is
 * what makes portaled overlays mirror too.
 */
export function LanguageSwitch() {
  const { i18n } = useTranslation('app');

  function handleChange(language: string) {
    void i18n.changeLanguage(language);
  }

  return (
    <SegmentedControlGroup
      value={i18n.language.startsWith('ar') ? 'ar' : 'en'}
      onValueChange={handleChange}
      className="w-full"
    >
      <SegmentedControl value="ar">العربية</SegmentedControl>
      <SegmentedControl value="en">English</SegmentedControl>
    </SegmentedControlGroup>
  );
}
