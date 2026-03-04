import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

export default function ScanAttendance() {
  const { sessionId } = useParams<{ sessionId: string }>();
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

    if (!sessionId) {
      setStatus('error');
      setMessage('קישור לא תקין');
      return;
    }

    const markAttendance = async () => {
      try {
        // Find student linked to this auth user
        const { data: studentData } = await supabase
          .from('students')
          .select('id, name, last_name')
          .eq('auth_user_id', user.id)
          .limit(1)
          .single();

        if (!studentData) {
          setStatus('no-student');
          return;
        }

        // Check if already marked
        const { data: existing } = await supabase
          .from('attendance')
          .select('id, status')
          .eq('session_id', sessionId)
          .eq('student_id', studentData.id)
          .limit(1)
          .single();

        if (existing) {
          if (existing.status === 'נוכח') {
            setStatus('already');
            setMessage(`${studentData.name} ${studentData.last_name || ''} - כבר סומנת כנוכח/ת!`);
          } else {
            // Update existing record
            await supabase
              .from('attendance')
              .update({ status: 'נוכח' })
              .eq('id', existing.id);
            
            setStatus('success');
            setMessage(`${studentData.name} ${studentData.last_name || ''} - נוכחות עודכנה בהצלחה! ✅`);
          }
        } else {
          // Get session info to find the admin user_id
          const { data: sessionData } = await supabase
            .from('sessions')
            .select('user_id')
            .eq('id', sessionId)
            .limit(1)
            .single();

          if (!sessionData) {
            setStatus('error');
            setMessage('שיעור לא נמצא');
            return;
          }

          // Insert new attendance record with admin's user_id
          const { error } = await supabase
            .from('attendance')
            .insert({
              user_id: sessionData.user_id,
              session_id: sessionId,
              student_id: studentData.id,
              status: 'נוכח',
            });

          if (error) {
            setStatus('error');
            setMessage('שגיאה ברישום נוכחות');
            return;
          }

          setStatus('success');
          setMessage(`${studentData.name} ${studentData.last_name || ''} - נרשמת בהצלחה! ✅`);
        }
      } catch {
        setStatus('error');
        setMessage('שגיאה לא צפויה');
      }
    };

    markAttendance();
  }, [user, authLoading, sessionId]);

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
            <Button onClick={() => navigate(`/student-auth?redirect=/scan/${sessionId}`)} className="w-full">
              התחבר כעת
            </Button>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="text-6xl">✅</div>
            <h2 className="text-xl font-bold text-green-600">{message}</h2>
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
