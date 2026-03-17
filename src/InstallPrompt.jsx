import { useState, useEffect } from 'react';

const InstallPrompt = ({ view }) => {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // A single state to track if the banner should be hidden for this session.
  // Initialize from sessionStorage.
  const [isDismissed, setIsDismissed] = useState(
    () => sessionStorage.getItem('installBannerDismissed') === 'true'
  );

  // This effect runs once on mount to set up listeners.
  useEffect(() => {
    // If already installed or dismissed, do nothing.
    if (isAppInstalled || isDismissed) return;

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isAppInstalled, isDismissed]);

  // This effect runs when the view changes, to dismiss the banner for the session
  // after the user navigates away from the home screen.
  useEffect(() => {
    // If not on home view AND the banner has not been dismissed yet
    if (view !== 'home' && !isDismissed) {
      // Dismiss it for the rest of the session.
      sessionStorage.setItem('installBannerDismissed', 'true');
      setIsDismissed(true);
    }
  }, [view, isDismissed]);

  const handleInstallClick = async () => {
    // When user interacts, dismiss it permanently for the session.
    if (!isDismissed) {
      sessionStorage.setItem('installBannerDismissed', 'true');
      setIsDismissed(true);
    }

    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
      }
    } else {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      if (/android/i.test(userAgent)) {
        alert('브라우저 메뉴(우측 상단 ⋮)에서 \'홈 화면에 추가\'를 선택하여 설치하세요.');
      } else {
        alert('브라우저 메뉴에서 \'홈 화면에 추가\'하여 앱을 설치할 수 있습니다.');
      }
    }
  };

  // Final render condition: Only show if not installed, not dismissed, and on the home screen.
  if (isAppInstalled || isDismissed || view !== 'home') {
    return null;
  }

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
