import { useEffect, useRef } from 'react';

interface Props {
  botName: string;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: 'write' | 'read';
  lang?: string;
}

// Use data-auth-url approach (server redirect) instead of data-onauth (JS callback)
// This is more reliable for SPAs on Vercel
export default function TelegramLogin({
  botName,
  buttonSize = 'large',
  cornerRadius = 8,
  requestAccess = 'write',
  lang = 'en',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-radius', String(cornerRadius));
    script.setAttribute('data-request-access', requestAccess);
    script.setAttribute('data-lang', lang);
    // Use auth URL redirect instead of JS callback
    script.setAttribute('data-auth-url', `${window.location.origin}/api/auth/telegram-callback`);

    containerRef.current?.appendChild(script);
  }, [botName, buttonSize, cornerRadius, requestAccess, lang]);

  return <div ref={containerRef} />;
}
