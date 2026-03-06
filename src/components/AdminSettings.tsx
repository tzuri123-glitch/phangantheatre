import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AdminSettings() {
  const { user } = useAuth();
  const [promptPayUrl, setPromptPayUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPromptPayImage();
  }, []);

  const loadPromptPayImage = async () => {
    const { data: files } = await supabase.storage
      .from('admin-settings')
      .list('', { limit: 10 });

    const promptPayFile = files?.find(f => f.name.startsWith('promptpay'));
    if (promptPayFile) {
      const { data } = supabase.storage
        .from('admin-settings')
        .getPublicUrl(promptPayFile.name);
      setPromptPayUrl(data.publicUrl);
    }
  };

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const handleUploadPromptPay = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('ניתן להעלות רק תמונות JPEG, PNG או WebP');
      return;
    }
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
        .upload(fileName, file, { contentType: file.type, upsert: true });

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
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUploadPromptPay}
            disabled={uploading}
          />
        </div>
      </Card>
    </div>
  );
}
