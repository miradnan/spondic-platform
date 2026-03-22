'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for i18n to initialize with the detected language before rendering
    // This prevents hydration mismatch between server (English) and client (detected language)
    const init = async () => {
      if (!i18n.isInitialized) {
        await new Promise<void>((resolve) => {
          i18n.on('initialized', () => resolve());
        });
      }

      const isRTL = i18n.language === 'ar';
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = i18n.language;

      setReady(true);
    };
    init();

    const handleChange = (lng: string) => {
      document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lng;
    };
    i18n.on('languageChanged', handleChange);
    return () => {
      i18n.off('languageChanged', handleChange);
    };
  }, []);

  // Don't render children until i18n is ready with the correct language
  // This avoids server/client text mismatch (hydration error)
  if (!ready) {
    return (
      <div className="min-h-screen bg-cream" aria-hidden="true">
        {/* Empty shell matching layout structure to prevent layout shift */}
      </div>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
