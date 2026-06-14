import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ requireAdmin = false }: ProtectedRouteProps) => {
  const { user, isAdmin, isLoading } = useAuth();

  // Yükleme sırasında ekranda bekleme animasyonu gösterelim
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Oturum Kontrol Ediliyor...</div>
      </div>
    );
  }

  // Giriş yapmamışsa logine yönlendir
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin yetkisi gerekiyorsa ve kullanıcı admin değilse (personelse) employee paneline yönlendir
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/employee" replace />;
  }

  // Yetkisi varsa alt rotaları veya bileşeni render et
  return <Outlet />;
};
