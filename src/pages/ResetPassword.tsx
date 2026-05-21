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
  const [email, setEmail] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setEmail(session?.user?.email || '');
      }
    });

    // Also check if we already have a session from recovery
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check URL hash for recovery type
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
          setReady(true);
          setEmail(session.user?.email || '');
        }
      }
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
      toast({ title: 'הסיסמה עודכנה בהצלחה! 🎉' });
      navigate('/');
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
