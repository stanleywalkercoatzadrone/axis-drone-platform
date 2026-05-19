/**
 * usePilotLocale — sets the i18n language based on the pilot's registered country
 * Call once at the top of PilotAppV2 or any pilot root component.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../services/apiClient';
import { countryToLocale } from '../i18n';

export function usePilotLocale() {
  const { i18n } = useTranslation();

  useEffect(() => {
    apiClient.get('/pilot/secure/me/profile')
      .then(r => {
        const country: string = r.data?.data?.country || 'US';
        const locale = countryToLocale[country.toUpperCase()] || 'en';
        if (i18n.language !== locale) {
          i18n.changeLanguage(locale);
        }
      })
      .catch(() => { /* stay on default */ });
  }, [i18n]);
}
