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
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-student' | 'no-session' | 'already' | 'not-auth'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatus('not-auth');
      return;
    }

    const markAttendance = async () => {
      try {
        // Find student linked to this auth user
        const { data: studentData } = await supabase
          .from('students')
          .select('id, name, last_name, class_name, user_id, is_sibling')
          .eq('auth_user_id', user.id)
          .limit(1)
          .single();

        if (!studentData) {
          setStatus('no-student');
          return;
        }

        const adminUserId = studentData.user_id;
        const today = new Date().toISOString().slice(0, 10);

        // Find today's session for this student's class
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('id')
          .eq('user_id', adminUserId)
          .eq('session_date', today)
          .eq('class_name', studentData.class_name)
          .limit(1)
          .single();

        if (!sessionData) {
          setStatus('no-session');
          setMessage('לא נמצא שיעור היום עבור הכיתה שלך');
          return;
        }

        // Check if already marked
        const { data: existing } = await supabase
          .from('attendance')
          .select('id, status')
          .eq('session_id', sessionData.id)
          .eq('student_id', studentData.id)
          .limit(1)
          .single();

        if (existing) {
          if (existing.status === 'נוכח') {
            setStatus('already');
            setMessage(`${studentData.name} ${studentData.last_name || ''} - כבר סומנת כנוכח/ת!`);
          } else {
            await supabase
              .from('attendance')
              .update({ status: 'נוכח' })
              .eq('id', existing.id);
            setStatus('success');
            setMessage(`${studentData.name} ${studentData.last_name || ''} - נוכחות עודכנה בהצלחה! ✅`);
          }
          return;
        }

        // Insert new attendance record
        const { error } = await supabase
          .from('attendance')
          .insert({
            user_id: adminUserId,
            session_id: sessionData.id,
            student_id: studentData.id,
            status: 'נוכח',
          });

        if (error) {
          setStatus('error');
          setMessage('שגיאה ברישום נוכחות');
          return;
        }

        // Check if student has active monthly subscription for this month
        const monthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const { data: monthlyPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('student_id', studentData.id)
          .eq('payment_type', 'חודשי')
          .gte('payment_date', `${monthYear}-01`)
          .lte('payment_date', `${monthYear}-31`)
          .limit(1)
          .single();

        if (!monthlyPayment) {
          // No monthly subscription - check if already has a pending single payment for today
          const { data: existingPending } = await supabase
            .from('pending_payments')
            .select('id')
            .eq('student_id', studentData.id)
            .eq('payment_type', 'חד פעמי')
            .eq('status', 'pending')
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`)
            .limit(1)
            .single();

          if (!existingPending) {
            // Auto-create pending payment (debt) for per-session student
            await supabase
              .from('pending_payments')
              .insert({
                student_id: studentData.id,
                admin_user_id: adminUserId,
                payment_type: 'חד פעמי',
                payment_method: 'מזומן',
                status: 'pending',
              });
          }

          setStatus('success');
          setMessage(`${studentData.name} ${studentData.last_name || ''} - נרשמת בהצלחה! ✅\n💰 נוצר חיוב תשלום חד פעמי`);
        } else {
          setStatus('success');
          setMessage(`${studentData.name} ${studentData.last_name || ''} - נרשמת בהצלחה! ✅`);
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

        {status === 'no-session' && (
          <div className="space-y-4">
            <div className="text-6xl">📅</div>
            <h2 className="text-xl font-bold text-foreground">{message}</h2>
            <p className="text-muted-foreground">ייתכן שהשיעור עוד לא נוצר או שאין שיעור היום</p>
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
