import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';

export default function StudentAuth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast({ title: 'נרשמת בהצלחה! מעביר אותך...' });
        navigate('/');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: 'התחברת בהצלחה!' });
        navigate('/');
      }
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/10 to-background p-4" dir="rtl">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="לוגו" className="h-24 mb-4" />
          <h1 className="text-3xl font-bold text-center text-foreground">
            {isSignUp ? 'הרשמה לתלמידים' : 'כניסה לתלמידים'}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {isSignUp ? 'צור חשבון חדש לצפייה בנוכחות ותשלומים' : 'התחבר לאזור האישי שלך'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">שם מלא</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="השם המלא שלך"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">אימייל</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">סיסמה</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="הכנס סיסמה"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'טוען...' : isSignUp ? 'הירשם' : 'התחבר'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-primary hover:underline"
          >
            {isSignUp ? 'כבר יש לך חשבון? התחבר' : 'אין לך חשבון? הירשם'}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-border text-center">
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="text-xs text-muted-foreground hover:underline"
          >
            כניסת מנהלים
          </button>
        </div>
      </Card>
    </div>
  );
}
