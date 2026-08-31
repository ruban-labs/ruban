import * as React from 'react';
import BootSplash from 'react-native-bootsplash';

const EXIT_FALLBACK_MS = 8000;

export function useBootSplashExit(): () => void {
  const hide = React.useCallback(() => {
    void BootSplash.hide({fade: false}).catch(error => {
      console.warn('Unable to hide the native boot splash.', error);
    });
  }, []);

  React.useEffect(() => {
    const fallback = setTimeout(hide, EXIT_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [hide]);

  return hide;
}
