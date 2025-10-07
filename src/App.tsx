import Index from "./pages/Index";
import { useAuth } from './hooks/useAuth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const App = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Index />;
};

export default App;
