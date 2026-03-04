import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

export default function MarkAttendance() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-student' | 'already' | 'not-auth'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatus('not-auth');
      return;
    }

    const markAttendance = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mark-attendance');

        if (error) {
          setStatus('error');
          setMessage('שגיאה בחיבור לשרת');
          return;
        }

        if (data.error === 'no-student') {
          setStatus('no-student');
          return;
        }

        if (data.error) {
          setStatus('error');
          setMessage(data.message || 'שגיאה');
          return;
        }

        if (data.status === 'already') {
          setStatus('already');
          setMessage(data.message);
        } else {
          setStatus('success');
          setMessage(data.message);
        }
      } catch {
        setStatus('error');
        setMessage('שגיאה לא צפויה');
      }
    };

    markAttendance();
  }, [user, authLoading]);

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-foreground text-xl">מעבד נוכחות... ⏳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/10 to-background p-4" dir="rtl">
      <Card className="w-full max-w-md p-8 text-center">
        <img src={logo} alt="לוגו" className="h-16 mx-auto mb-6" />

        {status === 'not-auth' && (
          <div className="space-y-4">
            <div className="text-6xl">🔒</div>
            <h2 className="text-xl font-bold text-foreground">יש להתחבר קודם</h2>
            <p className="text-muted-foreground">כדי לסמן נוכחות, עליך להתחבר לחשבון שלך</p>
            <Button onClick={() => navigate('/student-auth?redirect=/mark-attendance')} className="w-full">
              התחבר כעת
            </Button>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="text-6xl">✅</div>
            <h2 className="text-xl font-bold text-green-600 whitespace-pre-line">{message}</h2>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              חזור לדף הראשי
            </Button>
          </div>
        )}

        {status === 'already' && (
          <div className="space-y-4">
            <div className="text-6xl">👋</div>
            <h2 className="text-xl font-bold text-primary">{message}</h2>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              חזור לדף הראשי
            </Button>
          </div>
        )}

        {status === 'no-student' && (
          <div className="space-y-4">
            <div className="text-6xl">❓</div>
            <h2 className="text-xl font-bold text-foreground">החשבון לא מקושר</h2>
            <p className="text-muted-foreground">פנה למנהל כדי לקשר את החשבון שלך לפרופיל התלמיד</p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              חזור לדף הראשי
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="text-6xl">❌</div>
            <h2 className="text-xl font-bold text-destructive">{message}</h2>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              חזור לדף הראשי
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
