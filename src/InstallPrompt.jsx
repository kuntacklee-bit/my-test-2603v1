import { useState, useEffect } from 'react';

const InstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setShowInstallBanner(true);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsAppInstalled(true);
      setShowInstallBanner(false);
    };

    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    } else {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
      // Show banner if not installed and on a non-iOS device or if it's a standalone PWA on iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (!isIOS || window.navigator.standalone) {
        setShowInstallBanner(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const getManualInstallMessage = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent)) {
      return '브라우저 메뉴(우측 상단 ⋮)에서 \'홈 화면에 추가\'를 선택하여 설치하세요.';
    }
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      return '하단 공유 버튼(↑)을 탭하고 \'홈 화면에 추가\'를 선택하여 설치하세요.';
    }
    return '브라우저 메뉴에서 \'홈 화면에 추가\'하여 앱을 설치할 수 있습니다.';
  };

  const handleInstallClick = async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
      }
      setInstallPromptEvent(null);
      setShowInstallBanner(false);
    } else {
      alert(getManualInstallMessage());
    }
  };

  if (isAppInstalled || !showInstallBanner) {
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
