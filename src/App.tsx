import Index from "./pages/Index";
import StudentPortal from "./pages/StudentPortal";
import { useAuth } from './hooks/useAuth';
import { useUserRole } from './hooks/useUserRole';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const App = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  useSessionTimeout();

  const loading = authLoading || roleLoading;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/student-auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">טוען...</div>
      </div>
    );
  }

  if (!user) return null;

  if (role === 'admin') {
    return <Index />;
  }

  return <StudentPortal />;
};

export default App;
