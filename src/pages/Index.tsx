import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    
    // If not logged in, go to login
    if (!user) {
      navigate('/login');
    } else if (isAdmin && !localStorage.getItem('mock_user_session')) {
      // If real admin session (logged in via Manager tab), go to admin panel
      navigate('/admin');
    } else {
      // If logged in via Personnel tab (mock session) or regular user, go to employee panel
      navigate('/employee');
    }
  }, [user, isAdmin, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
    </div>
  );
};

export default Index;
