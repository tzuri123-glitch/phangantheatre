import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function KioskSettings() {
  const [kioskPin, setKioskPin] = useState('');
  const [kioskPin2, setKioskPin2] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const kioskUrl = `${window.location.origin}/kiosk`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-4 sm:p-6">
        <h3 className="text-lg font-bold text-foreground mb-2">🖥️ קיוסק נוכחות (אייפד)</h3>
        <p className="text-muted-foreground text-sm mb-4">
          רישום במצב קיוסק יוצר אוטומטית חוב חד-פעמי לתלמיד שאין לו מנוי חודשי פעיל.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => window.open('/kiosk', '_blank', 'noopener')}>פתח קיוסק בכרטיסייה חדשה</Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(kioskUrl);
                toast.success('הקישור הועתק!');
              } catch {
                toast.error('לא ניתן להעתיק');
              }
            }}
          >
            העתק קישור
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 break-all">{kioskUrl}</p>
      </Card>

      <Card className="p-4 sm:p-6">
        <h3 className="text-lg font-bold text-foreground mb-2">🔒 קוד PIN לקיוסק</h3>
        <p className="text-muted-foreground text-sm mb-4">קבע קוד PIN לכניסה לקיוסק (4-8 ספרות).</p>
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
