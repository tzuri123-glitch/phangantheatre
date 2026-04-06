import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      toast({ title: 'התחברת בהצלחה!' });
      navigate('/');
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(42 50% 14% / 0.5), transparent), hsl(220 18% 7%)',
      }}
    >
      {/* Subtle top glow */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(42 88% 52% / 0.6), transparent)' }}
      />

      <div className="w-full max-w-sm stage-reveal">
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="p-3 rounded-2xl mb-4"
            style={{ background: 'hsl(220 18% 12%)', boxShadow: '0 0 32px hsl(42 88% 52% / 0.2)' }}
          >
            <img src={logo} alt="לוגו" className="h-20 object-contain" />
          </div>
          <h1
            className="text-3xl font-bold text-center mb-1"
            style={{
              fontFamily: "'Frank Ruhl Libre', serif",
              background: 'linear-gradient(135deg, hsl(42 88% 62%), hsl(42 70% 82%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            מרכז אומנויות הבמה
          </h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase">Phangan</p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-7 border border-border/50"
          style={{
            background: 'hsl(220 18% 11%)',
            boxShadow: '0 20px 60px hsl(0 0% 0% / 0.5), 0 0 0 1px hsl(42 88% 52% / 0.08)',
          }}
        >
          <h2 className="text-lg font-semibold text-center mb-6 text-foreground/80">כניסה למערכת</h2>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">אימייל</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@email.com"
                className="bg-background/60 border-border/60 focus:border-primary placeholder:text-muted-foreground/50"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">סיסמה</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="bg-background/60 border-border/60 focus:border-primary placeholder:text-muted-foreground/50"
              />
            </div>

            <Button
              type="submit"
              className="w-full font-bold text-base h-11 mt-2 button-hover"
              disabled={loading}
              style={{
                background: loading
                  ? 'hsl(220 18% 20%)'
                  : 'linear-gradient(135deg, hsl(42 88% 48%), hsl(42 88% 40%))',
                color: 'hsl(220 18% 7%)',
                boxShadow: loading ? 'none' : '0 0 20px hsl(42 88% 52% / 0.3)',
              }}
            >
              {loading ? '...' : 'כניסה'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
