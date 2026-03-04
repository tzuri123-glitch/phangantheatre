import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface MFAChallengeProps {
  onVerified: () => void;
}

export default function MFAChallenge({ onVerified }: MFAChallengeProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState('');

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return;
    const totp = data.totp?.[0];
    if (totp) setFactorId(totp.id);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !code) return;
    setLoading(true);

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      toast.success('אימות דו-שלבי הצליח');
      onVerified();
    } catch (error: any) {
      toast.error('קוד שגוי, נסה שנית');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-sm p-8">
        <h2 className="text-xl font-bold text-center mb-2 text-foreground">אימות דו-שלבי</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          הכנס את הקוד מאפליקציית האימות שלך
        </p>
        <form onSubmit={handleVerify} className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="text-center text-2xl tracking-widest font-mono"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? 'מאמת...' : 'אמת'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
