import { useEffect } from 'react';

/** Sets the browser tab title for a page. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · EarnX` : 'EarnX — get paid when you ship';
  }, [title]);
}
