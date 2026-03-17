
import { useState, useEffect } from 'react';

const InstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      // 기본 미니 정보 표시줄 표시 방지
      event.preventDefault();
      // 나중에 트리거할 수 있도록 이벤트 저장
      setInstallPromptEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 앱이 이미 설치되었는지 확인
    window.addEventListener('appinstalled', () => {
      // 설치 프롬프트 숨기기
      setInstallPromptEvent(null);
      setIsAppInstalled(true);
    });
    
    // PWA 모드(독립 실행형)인지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', () => {});
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      return;
    }
    // 설치 프롬프트 표시
    installPromptEvent.prompt();
    // 사용자의 응답을 기다림
    const { outcome } = await installPromptEvent.userChoice;
    // 프롬프트를 사용했으므로 다시 사용할 수 없도록 초기화
    setInstallPromptEvent(null);
    if (outcome === 'accepted') {
        setIsAppInstalled(true);
    }
  };

  // 앱이 설치되지 않았고, 설치 프롬프트 이벤트를 사용할 수 있을 때만 설치 버튼 표시
  if (isAppInstalled || !installPromptEvent) {
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
        backgroundColor: '#f59e0b', // manifest theme_color
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
          backgroundColor: '#d97706', // 버튼을 위한 더 어두운 색상
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        설치
      </button>
    </div>
  );
};

export default InstallPrompt;
