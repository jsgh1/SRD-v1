import { useEffect, useState } from 'react';

// Display time only: never queries the API or renews session activity.
export function useCalendarClock(): number {
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible') setClock(Date.now()); };
    const timer = window.setInterval(update, 1000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return clock;
}
