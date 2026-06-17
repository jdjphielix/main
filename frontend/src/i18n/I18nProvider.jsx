import React, { useEffect } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './en.json';
import nlTranslations from './nl.json';

// Detect language from sessionStorage or browser
const savedLang = typeof window !== 'undefined'
  ? sessionStorage.getItem('i18nextLng') || navigator.language?.split('-')[0] || 'nl'
  : 'nl';

// Initialize i18next without external language detector
i18n
  .use(initReactI18next)
  .init({
    lng: savedLang === 'nl' || savedLang === 'en' ? savedLang : 'nl',
    fallbackLng: 'nl',
    defaultNS: 'translation',
    ns: ['translation'],
    resources: {
      en: {
        translation: enTranslations,
      },
      nl: {
        translation: nlTranslations,
      },
    },
    interpolation: {
      escapeValue: false, // React handles XSS
    },
  });

export const I18nProvider = ({ children }) => {
  useEffect(() => {
    document.documentElement.lang = i18n.language;

    const handleLanguageChange = (lng) => {
      document.documentElement.lang = lng;
      sessionStorage.setItem('i18nextLng', lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return children;
};

export default i18n;
