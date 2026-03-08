import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check URL hash for recovery parameters
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(hash.substring(1)); // Remove leading #
    const type = searchParams.get('type');
    const accessToken = searchParams.get('access_token');
    
    console.log('Reset password check - type:', type, 'hasToken:', !!accessToken);
    
    // If we have type=recovery in the URL, we're in recovery mode
    if (type === 'recovery' && accessToken) {
      // Set the session from the recovery link
      const refreshToken = searchParams.get('refresh_token') || '';
      
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error setting session:', error);
          setChecking(false);
          return;
        }
        
        if (data.session) {
          setReady(true);
          setEmail(data.session.user?.email || '');
        }
        setChecking(false);
      });
      return;
    }

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event);
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setEmail(session?.user?.email || '');
        setChecking(false);
      }
    });

    // Also check if we already have a session from recovery
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no recovery params in URL, just show forgot password form
      if (!hash.includes('type=recovery')) {
        setForgotMode(true);
        setChecking(false);
        return;
      }
      
      if (session) {
        setReady(true);
        setEmail(session.user?.email || '');
      }
      setChecking(false);
    };
    
    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast({ title: 'שגיאה', description: 'הסיסמה חייבת להכיל לפחות 8 תווים', variant: 'destructive' });
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast({ title: 'שגיאה', description: 'הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית', variant: 'destructive' });
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast({ title: 'שגיאה', description: 'הסיסמה חייבת להכיל לפחות מספר אחד', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'שגיאה', description: 'הסיסמאות אינן תואמות', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      // Sign out after password reset so user needs to log in with new password
      await supabase.auth.signOut();
      
      toast({ title: 'הסיסמה עודכנה בהצלחה! 🎉', description: 'אנא התחבר עם הסיסמה החדשה' });
      navigate('/student-auth');
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast({ title: 'שגיאה', description: 'הכנס כתובת אימייל', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
      toast({ title: 'נשלח אליך אימייל לאיפוס סיסמה 📧' });
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/10 to-background p-4" dir="rtl">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center">
            <img src={logo} alt="לוגו" className="h-24 mb-4" />
            <p className="text-foreground">טוען...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/10 to-background p-4" dir="rtl">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="לוגו" className="h-24 mb-4" />
          <h1 className="text-2xl font-bold text-center text-foreground">
            {forgotMode ? 'שכחתי סיסמה' : 'איפוס סיסמה'}
          </h1>
        </div>

        {forgotMode || !ready ? (
          // Forgot password / request reset form
          forgotSent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <p className="text-foreground">נשלח אליך אימייל עם קישור לאיפוס סיסמה.</p>
              <p className="text-sm text-muted-foreground">בדוק את תיבת הדואר שלך (כולל ספאם)</p>
              <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/student-auth')}>
                חזרה לכניסה
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                הכנס את כתובת האימייל שלך ונשלח לך קישור לאיפוס סיסמה
              </p>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">אימייל</label>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  placeholder="example@email.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'שולח...' : 'שלח קישור איפוס'}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => navigate('/student-auth')} className="text-sm text-primary hover:underline">
                  חזרה לכניסה
                </button>
              </div>
            </form>
          )
        ) : (
          // Set new password form
          <form onSubmit={handleResetPassword} className="space-y-4">
            {email && (
              <p className="text-sm text-muted-foreground text-center mb-2">
                מעדכן סיסמה עבור: <strong>{email}</strong>
              </p>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">סיסמה חדשה</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="הכנס סיסמה חדשה"
                  className="pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                לפחות 8 תווים, אות גדולה אחת באנגלית ומספר אחד
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">אישור סיסמה חדשה</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="הכנס סיסמה פעם נוספת"
                  className="pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'מעדכן...' : 'עדכן סיסמה'}
            </Button>

            <div className="text-center">
              <button type="button" onClick={() => setForgotMode(true)} className="text-sm text-primary hover:underline">
                שכחתי סיסמה? שלח קישור חדש
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
