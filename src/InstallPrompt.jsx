import { useState, useEffect } from 'react';

const InstallPrompt = ({ view }) => {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 앱이 이미 설치되었는지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
      return;
    }

    // 세션 중에 배너가 이미 표시되었는지 확인
    const hasBeenShown = sessionStorage.getItem('installBannerShown') === 'true';
    if (hasBeenShown) {
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
  }, []); // 이 effect는 마운트 시 한 번만 실행됩니다.

  useEffect(() => {
    const hasBeenShown = sessionStorage.getItem('installBannerShown') === 'true';
    
    // 배너를 표시할 조건:
    // 1. 앱이 설치되지 않았어야 합니다.
    // 2. 현재 세션에서 배너가 표시된 적이 없어야 합니다.
    // 3. 현재 view가 'home'이어야 합니다.
    // 4. PWA 설치 이벤트가 준비되어야 합니다.
    if (!isAppInstalled && !hasBeenShown && view === 'home' && installPromptEvent) {
      setIsVisible(true);
      // 배너가 표시되면 세션 스토리지에 기록합니다.
      sessionStorage.setItem('installBannerShown', 'true');
    } else if (view !== 'home' && isVisible) {
      // 다른 화면으로 이동하면 배너를 숨깁니다.
      setIsVisible(false);
    }
  }, [view, installPromptEvent, isAppInstalled, isVisible]);

  const handleInstallClick = async () => {
    // 설치 버튼을 클릭하면 배너를 숨깁니다.
    setIsVisible(false);

    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
      }
    } else {
      // 설치 프롬프트가 지원되지 않는 경우 수동 설치 안내
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      if (/android/i.test(userAgent)) {
        alert('브라우저 메뉴(우측 상단 ⋮)에서 \'홈 화면에 추가\'를 선택하여 설치하세요.');
      } else {
        alert('브라우저 메뉴에서 \'홈 화면에 추가\'하여 앱을 설치할 수 있습니다.');
      }
    }
  };

  if (!isVisible) {
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
