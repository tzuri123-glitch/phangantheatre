import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface EnrollMFAProps {
  onEnrolled: () => void;
  onSkipped: () => void;
}

export default function EnrollMFA({ onEnrolled, onSkipped }: EnrollMFAProps) {
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    enroll();
  }, []);

  const enroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    });
    if (error) {
      toast.error('שגיאה בהגדרת 2FA: ' + error.message);
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
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

      toast.success('אימות דו-שלבי הופעל בהצלחה! 🔐');
      onEnrolled();
    } catch (error: any) {
      toast.error('קוד שגוי, נסה שנית');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md p-8">
        <h2 className="text-xl font-bold text-center mb-2 text-foreground">הגדרת אימות דו-שלבי (2FA)</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          סרוק את קוד ה-QR באפליקציית אימות (Google Authenticator, Authy וכו׳)
        </p>

        {qrCode && (
          <div className="flex flex-col items-center mb-6">
            <img src={qrCode} alt="QR Code" className="w-48 h-48 mb-3" />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="text-xs text-primary hover:underline"
            >
              {showSecret ? 'הסתר קוד ידני' : 'לא מצליח לסרוק? הצג קוד ידני'}
            </button>
            {showSecret && (
              <code className="mt-2 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                {secret}
              </code>
            )}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">הכנס את הקוד מהאפליקציה</label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? 'מאמת...' : 'אמת והפעל 2FA'}
          </Button>
        </form>

        <Button variant="ghost" className="w-full mt-3 text-muted-foreground" onClick={onSkipped}>
          דלג (לא מומלץ)
        </Button>
      </Card>
    </div>
  );
}
