import { useState, useEffect } from 'react';

const InstallPrompt = ({ view }) => {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Effect to setup listeners and decide initial visibility.
  useEffect(() => {
    const isDismissed = sessionStorage.getItem('installBannerDismissed') === 'true';
    if (isDismissed) {
      return;
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    } else {
      const handleBeforeInstallPrompt = (event) => {
        event.preventDefault();
        setInstallPromptEvent(event);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      setShowBanner(true); // Always show if not installed and not dismissed.
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  // Effect to dismiss banner for the session when navigating away from home.
  useEffect(() => {
    if (showBanner && view !== 'home') {
      setShowBanner(false);
      sessionStorage.setItem('installBannerDismissed', 'true');
    }
  }, [view, showBanner]);
  
  const getManualInstallMessage = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent)) {
      return '브라우저 메뉴(우측 상단 ⋮)에서 \'홈 화면에 추가\'를 선택하여 설치하세요.';
    }
    return '브라우저 메뉴에서 \'홈 화면에 추가\'하여 앱을 설치할 수 있습니다.';
  };

  const handleInstallClick = async () => {
    // Hide and dismiss for the session after interaction.
    setShowBanner(false);
    sessionStorage.setItem('installBannerDismissed', 'true');

    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
      }
    } else {
      alert(getManualInstallMessage());
    }
  };

  // The condition to render the banner.
  if (isAppInstalled || !showBanner || view !== 'home') {
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
