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
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      {/* Ambient blobs */}
      <div className="ambient-blob w-96 h-96 opacity-20" style={{ background: 'var(--color-blue)', top: '-10%', right: '10%' }} />
      <div className="ambient-blob w-80 h-80 opacity-15" style={{ background: 'var(--color-purple)', bottom: '5%', left: '5%' }} />

      <div className="w-full max-w-sm relative z-10 slide-up">
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <div className="float mb-5">
            <img src={logo} alt="לוגו" className="h-20 w-20 object-contain rounded-2xl" style={{ filter: 'drop-shadow(0 0 20px rgba(100,139,255,0.4))' }} />
          </div>
          <h1 className="text-3xl font-bold mb-1 gradient-text">Phangan Arts</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Music & Performing Arts</p>
        </div>

        {/* Form */}
        <div className="glass-card p-7">
          <p className="text-center text-sm font-medium mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>כניסת מנהל</p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>אימייל</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                dir="ltr"
                className="dark-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="dark-input"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-gradient w-full mt-2">
              {loading ? 'נכנס...' : 'כניסה'}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <button onClick={() => navigate('/student-auth')} className="text-sm hover:underline" style={{ color: 'var(--color-blue)' }}>
            כניסת תלמידים והורים ←
          </button>
        </div>
      </div>
    </div>
  );
}
