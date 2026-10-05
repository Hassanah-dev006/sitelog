import { useEffect, useState } from 'react';

/**
 * Tracks whether the phone thinks it has a connection.
 *
 * navigator.onLine is optimistic — it reports true on a wifi network with no
 * internet behind it — so it is used to decide *when to try*, never as proof
 * that a request will succeed. A failed request is the real signal, and the
 * outbox handles that.
 */
export default function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
