import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const AntiCopyProtection = () => {
  const { user } = useAuth();

  useEffect(() => {
    // Süper admin ise korumayı devre dışı bırak, rahatça debug yapabilsin
    if (user?.email === 'turgaydolu23@gmail.com') {
      document.body.classList.remove('select-none-global');
      return;
    }

    // CSS sınıfını ekle (metin seçimi engeli)
    document.body.classList.add('select-none-global');

    // Sağ tık engelleme
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // toast.warning('Sistem güvenliği nedeniyle sağ tık kapalıdır.', { duration: 1500 });
    };

    // Klavye kısayollarını engelleme
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
      }
      
      // Ctrl+Shift+I / J / C (DevTools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'i' || e.key === 'j' || e.key === 'c')) {
        e.preventDefault();
      }
      
      // Ctrl+U (Kaynağı Görüntüle)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
      }
      
      // Ctrl+S (Sayfayı Kaydet)
      if (e.ctrlKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
      }
      
      // Ctrl+P (Yazdır / PDF Kaydet)
      if (e.ctrlKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
      }
    };

    // Kopyalama engeli
    const handleCopy = (e: ClipboardEvent) => {
      // Sadece input ve textarea alanlarında kopyalamaya izin ver
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };

    // Dinleyicileri ekle
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);

    // Temizlik
    return () => {
      document.body.classList.remove('select-none-global');
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
    };
  }, [user]);

  return null;
};
