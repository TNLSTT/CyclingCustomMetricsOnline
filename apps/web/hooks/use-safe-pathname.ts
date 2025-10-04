'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname as useNextPathname } from 'next/navigation';

function getWindowPathname() {
  if (typeof window === 'undefined') {
    return '/';
  }

  try {
    return window.location.pathname || '/';
  } catch (error) {
    return '/';
  }
}

export function useSafePathname(): string {
  let pathnameFromNext: string | null = null;

  try {
    pathnameFromNext = useNextPathname();
  } catch (error) {
    pathnameFromNext = null;
  }

  const [fallbackPathname, setFallbackPathname] = useState<string>(() => getWindowPathname());

  const originalsRef = useRef<{
    pushState: History['pushState'];
    replaceState: History['replaceState'];
  } | null>(null);

  useEffect(() => {
    if (pathnameFromNext !== null) {
      setFallbackPathname(pathnameFromNext);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const handleNavigation = () => {
      setFallbackPathname(getWindowPathname());
    };

    handleNavigation();

    window.addEventListener('popstate', handleNavigation);

    if (!originalsRef.current) {
      originalsRef.current = {
        pushState: window.history.pushState.bind(window.history),
        replaceState: window.history.replaceState.bind(window.history),
      };
    }

    const { pushState, replaceState } = originalsRef.current;

    const wrapHistoryMethod = <Method extends (...methodArgs: any[]) => void>(original: Method) => {
      return function wrappedHistoryMethod(this: History, ...args: Parameters<Method>) {
        original.apply(this, args);
        handleNavigation();
      };
    };

    window.history.pushState = wrapHistoryMethod(pushState);
    window.history.replaceState = wrapHistoryMethod(replaceState);

    return () => {
      window.removeEventListener('popstate', handleNavigation);

      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
    };
  }, [pathnameFromNext]);

  return useMemo(() => pathnameFromNext ?? fallbackPathname, [pathnameFromNext, fallbackPathname]);
}
