import Index from "./pages/Index";
import StudentPortal from "./pages/StudentPortal";
import { useAuth } from './hooks/useAuth';
import { useUserRole } from './hooks/useUserRole';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MFAChallenge from './components/MFAChallenge';
import EnrollMFA from './components/EnrollMFA';

const App = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  useSessionTimeout();

  const loading = authLoading || roleLoading;

  const [mfaState, setMfaState] = useState<'loading' | 'needs_enroll' | 'needs_verify' | 'verified'>('loading');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/student-auth');
    }
  }, [user, loading, navigate]);

  // Check MFA status for admin
  useEffect(() => {
    if (loading || !user || role !== 'admin') {
      if (!loading && user && role !== 'admin') {
        setMfaState('verified'); // students don't need MFA
      }
      return;
    }

    const checkMFA = async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        setMfaState('verified'); // fallback
        return;
      }

      if (data.currentLevel === 'aal2') {
        setMfaState('verified');
      } else if (data.nextLevel === 'aal2') {
        // Has enrolled factor but hasn't verified yet
        setMfaState('needs_verify');
      } else {
        // No factor enrolled - offer enrollment
        setMfaState('needs_enroll');
      }
    };

    checkMFA();
  }, [user, role, loading]);

  if (loading || (role === 'admin' && mfaState === 'loading')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">טוען...</div>
      </div>
    );
  }

  if (!user) return null;

  if (role === 'admin') {
    if (mfaState === 'needs_verify') {
      return <MFAChallenge onVerified={() => setMfaState('verified')} />;
    }
    if (mfaState === 'needs_enroll') {
      return <EnrollMFA onEnrolled={() => setMfaState('verified')} onSkipped={() => setMfaState('verified')} />;
    }
    return <Index />;
  }

  return <StudentPortal />;
};

export default App;
