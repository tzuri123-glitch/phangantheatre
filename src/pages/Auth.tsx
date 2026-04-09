import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/');
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-sm slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="לוגו" className="h-16 w-16 object-contain mb-4 rounded-2xl" />
          <h1 className="text-2xl font-semibold text-foreground">כניסת מנהל</h1>
          <p className="text-sm text-muted-foreground mt-1">Phangan Music & Performing Arts</p>
        </div>

        {/* Card */}
        <div className="apple-card p-6">
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                dir="ltr"
                className="apple-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="apple-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="apple-btn-primary w-full mt-2"
            >
              {loading ? 'נכנס...' : 'כניסה'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/student-auth')}
            className="text-sm text-primary hover:underline"
          >
            כניסת תלמידים והורים
          </button>
        </div>
      </div>
    </div>
  );
}
