import { useState, useEffect } from 'react';

const InstallPrompt = ({ view }) => {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  // This state will control the immediate visibility of the banner.
  const [showBanner, setShowBanner] = useState(false);

  // This effect runs once to set up the environment.
  useEffect(() => {
    // 1. Check if the app is already in standalone mode.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
      return;
    }

    // 2. Add the event listener for the install prompt.
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []); // Run only on mount.

  // This effect reacts to changes to decide if the banner should be shown or hidden.
  useEffect(() => {
    // Check the session storage to see if we've already shown the banner.
    const hasBeenShownThisSession = sessionStorage.getItem('installBannerShown') === 'true';

    // Conditions to show the banner:
    const shouldShow = 
      view === 'home' &&         // Must be on the home screen
      !isAppInstalled &&         // App must not be installed
      !hasBeenShownThisSession &&// Banner must not have been shown this session
      !!installPromptEvent;      // The install prompt event must be available

    if (shouldShow) {
      // If we should show it, update the state and mark it as shown in session storage.
      setShowBanner(true);
      sessionStorage.setItem('installBannerShown', 'true');
    } else {
      // In all other cases (e.g., navigating away from home), hide the banner.
      setShowBanner(false);
    }
  }, [view, installPromptEvent, isAppInstalled]); // Re-evaluate when these change.

  const handleInstallClick = async () => {
    // Hide the banner on interaction.
    setShowBanner(false);

    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true); // From now on, the banner won't show.
      }
    } else {
      // Fallback for manual installation instructions.
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      if (/android/i.test(userAgent)) {
        alert('브라우저 메뉴(우측 상단 ⋮)에서 \'홈 화면에 추가\'를 선택하여 설치하세요.');
      } else {
        alert('브라우저 메뉴에서 \'홈 화면에 추가\'하여 앱을 설치할 수 있습니다.');
      }
    }
  };

  // If the banner is not supposed to be shown, render nothing.
  if (!showBanner) {
    return null;
  }

  // Otherwise, render the banner.
  return (
    <div
      data-install-banner
      style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        right: '10px',
        backgroundColor: '#f59e0b',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        zIndex: 1000,
      }}
    >
      <span>'감사코인'을 홈 화면에 추가하세요!</span>
      <button
        onClick={handleInstallClick}
        style={{
          backgroundColor: '#d97706',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        {installPromptEvent ? '설치' : '설치 안내'}
      </button>
    </div>
  );
};

export default InstallPrompt;
