import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AdminSettings() {
  const { user } = useAuth();
  const [promptPayUrl, setPromptPayUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kioskPin, setKioskPin] = useState('');
  const [kioskPin2, setKioskPin2] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    loadPromptPayImage();
  }, []);

  const loadPromptPayImage = async () => {
    const { data: files } = await supabase.storage
      .from('admin-settings')
      .list('', { limit: 10 });

    const promptPayFile = files?.find(f => f.name.startsWith('promptpay'));
    if (promptPayFile) {
      const { data: signed } = await supabase.storage
        .from('admin-settings')
        .createSignedUrl(promptPayFile.name, 60 * 60);
      if (signed) setPromptPayUrl(signed.signedUrl);
    }
  };

  const handleUploadPromptPay = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    setUploading(true);

    try {
      // Delete old file first
      const { data: files } = await supabase.storage
        .from('admin-settings')
        .list('', { limit: 10 });

      const oldFile = files?.find(f => f.name.startsWith('promptpay'));
      if (oldFile) {
        await supabase.storage.from('admin-settings').remove([oldFile.name]);
      }

      const ext = file.name.split('.').pop();
      const fileName = `promptpay.${ext}`;

      const { error } = await supabase.storage
        .from('admin-settings')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from('admin-settings')
        .getPublicUrl(fileName);

      setPromptPayUrl(data.publicUrl);
      toast.success('תמונת PromptPay עודכנה!');
    } catch (error: any) {
      toast.error('שגיאה בהעלאת התמונה: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-6">
      <h2 className="text-xl sm:text-3xl font-bold text-foreground">הגדרות</h2>

      <Card className="p-4 sm:p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">📱 PromptPay QR Code</h3>
        <p className="text-muted-foreground text-sm mb-4">
          העלה את תמונת ה-QR של PromptPay שלך. התלמידים יוכלו לראות ולהוריד אותה כדי לבצע תשלום.
        </p>

        {promptPayUrl && (
          <div className="mb-4 flex justify-center">
            <img
              src={promptPayUrl}
              alt="PromptPay QR"
              className="max-w-[200px] rounded-lg shadow-md"
            />
          </div>
        )}

        <div>
          <Label htmlFor="promptpay-upload" className="cursor-pointer">
            <div className="border-2 border-dashed border-primary/50 rounded-xl p-6 text-center hover:bg-accent/50 transition-colors">
              <p className="text-sm text-primary font-medium">
                {uploading ? 'מעלה...' : promptPayUrl ? 'לחץ להחלפת תמונה' : 'לחץ להעלאת תמונת QR'}
              </p>
            </div>
          </Label>
          <input
            id="promptpay-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadPromptPay}
            disabled={uploading}
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h3 className="text-lg font-bold text-foreground mb-2">🖥️ קיוסק נוכחות (אייפד)</h3>
        <p className="text-muted-foreground text-sm mb-4">
          קבע קוד PIN לכניסה לקיוסק. גישה לקיוסק דרך הכתובת{' '}
          <a href="/kiosk" target="_blank" rel="noreferrer" className="text-primary underline font-semibold">/kiosk</a>.
          רישום במצב קיוסק יוצר אוטומטית חוב חד-פעמי לתלמיד שאין לו מנוי חודשי פעיל.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-sm">קוד PIN (4-8 ספרות)</Label>
            <Input type="password" inputMode="numeric" value={kioskPin} onChange={(e) => setKioskPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" maxLength={8} />
          </div>
          <div>
            <Label className="text-sm">אימות PIN</Label>
            <Input type="password" inputMode="numeric" value={kioskPin2} onChange={(e) => setKioskPin2(e.target.value.replace(/\D/g, ''))} placeholder="••••" maxLength={8} />
          </div>
        </div>
        <Button
          disabled={savingPin || !kioskPin || kioskPin.length < 4}
          onClick={async () => {
            if (kioskPin !== kioskPin2) { toast.error('הקודים אינם תואמים'); return; }
            setSavingPin(true);
            const { data, error } = await supabase.functions.invoke('kiosk-set-pin', { body: { pin: kioskPin } });
            setSavingPin(false);
            if (error || !data?.ok) { toast.error('שגיאה בשמירת הקוד'); return; }
            setKioskPin(''); setKioskPin2('');
            toast.success('קוד הקיוסק נשמר!');
          }}
        >
          {savingPin ? 'שומר...' : 'שמור קוד'}
        </Button>
      </Card>
    </div>
  );
}
