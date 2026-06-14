import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { toast } from "sonner";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Automatically show our custom prompt
      setShowPrompt(true);
      setIsIOS(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Detect iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    
    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
      // Don't show immediately on every load to prevent spamming, maybe check localStorage
      const hasSeenPrompt = localStorage.getItem('iosPwaPromptSeen');
      if (!hasSeenPrompt) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
    }

    // Notification check for standalone apps (iOS web push requires standalone mode)
    if (isStandalone && 'Notification' in window && Notification.permission === 'default') {
      const hasSeenNotifPrompt = localStorage.getItem('notifPromptSeen');
      if (!hasSeenNotifPrompt) {
        setTimeout(() => setShowNotificationPrompt(true), 2000);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // 1. Ask for Notification permission simultaneously
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.error("Notification request error:", error);
      }
    }

    if (!deferredPrompt) return;
    
    // 2. Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    await deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleNotificationAllow = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Bildirimlere izin verildi!');
      } else {
        toast.error('Bildirim izni reddedildi.');
      }
    }
    setShowNotificationPrompt(false);
    localStorage.setItem('notifPromptSeen', 'true');
  };

  if (showNotificationPrompt) {
    return (
      <Dialog open={showNotificationPrompt} onOpenChange={(open) => {
        setShowNotificationPrompt(open);
        if (!open) localStorage.setItem('notifPromptSeen', 'true');
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-xl overflow-hidden shadow-sm bg-primary/10 flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-center">Bildirimleri Açın</DialogTitle>
            <DialogDescription className="text-center">
              Önemli duyurulardan, vardiya değişikliklerinden ve görevlerden anında haberdar olmak için lütfen bildirimlere izin verin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-center mt-4">
            <Button variant="outline" onClick={() => {
              setShowNotificationPrompt(false);
              localStorage.setItem('notifPromptSeen', 'true');
            }}>
              Daha Sonra
            </Button>
            <Button onClick={handleNotificationAllow}>
              İzin Ver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-16 h-16 rounded-xl overflow-hidden shadow-sm">
            <img src="/logo.png" alt="Mağaza Takibi Logo" className="w-full h-full object-cover" />
          </div>
          <DialogTitle className="text-center">Uygulamayı Ana Ekrana Ekle</DialogTitle>
          <DialogDescription className="text-center space-y-4 flex flex-col">
            {isIOS ? (
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {import.meta.env.VITE_APP_BRAND === 'demo' || import.meta.env.VITE_APP_BRAND === 'magazatakibi' ? 'MAĞAZA TAKİBİ' : 'PAULMARK MAĞAZA TAKİBİ'} uygulamasını cihazınıza yüklemek için Safari'de alt menüdeki <strong>Paylaş</strong> simgesine dokunun ve ardından <strong>Ana Ekrana Ekle</strong> seçeneğini seçin.
              </p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {import.meta.env.VITE_APP_BRAND === 'demo' || import.meta.env.VITE_APP_BRAND === 'magazatakibi' ? 'MAĞAZA TAKİBİ' : 'PAULMARK MAĞAZA TAKİBİ'} uygulamasını cihazınıza yükleyerek daha hızlı ve kolay erişim sağlayabilirsiniz. Ayrıca bildirimleri açarak tüm yeniliklerden anında haberdar olabilirsiniz.
              </p>
            )}
            {isIOS && (
              <span className="text-xs text-primary font-medium mt-2 bg-primary/10 p-2 rounded">
                Not: Bildirimleri alabilmek için uygulamayı ana ekrana ekledikten sonra oradan açmanız gerekmektedir.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-center mt-4">
          <Button variant="outline" onClick={() => {
            setShowPrompt(false);
            if (isIOS) localStorage.setItem('iosPwaPromptSeen', 'true');
          }}>
            Daha Sonra
          </Button>
          {!isIOS && (
            <Button onClick={handleInstallClick}>
              Hemen Ekle & Bildirimleri Aç
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
