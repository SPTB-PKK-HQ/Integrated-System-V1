'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useAuth } from '@/hooks/useAuth';
import { GOOGLE_CLIENT_ID } from '@/lib/constants';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function GoogleSignIn() {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const initialisedRef = useRef(false);

  const initGIS = () => {
    if (initialisedRef.current || !window.google?.accounts?.id || !buttonRef.current) return;

    initialisedRef.current = true;
    setIsLoading(false);

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        setIsLoading(true);
        setError('');
        try {
          await loginWithGoogle(response.credential);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Ralat pengesahan. Sila cuba lagi.';
          setError(msg);
        } finally {
          setIsLoading(false);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'filled_blue',
      size: 'large',
      type: 'standard',
      shape: 'pill',
      width: 320,
      logo_alignment: 'left',
    });
  };

  useEffect(() => {
    if (window.google?.accounts?.id) {
      initGIS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGIS}
      />
      <div
        ref={buttonRef}
        className="flex justify-center items-center min-h-[50px]"
        style={{ display: isLoading ? 'none' : 'flex' }}
      />
      {isLoading && (
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Memuatkan...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm font-semibold max-w-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
}
