import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (url: string) => void;
}

export default function QrScanner({ open, onClose, onScan }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const runningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<string>('qr-reader-' + Date.now());
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      scannedRef.current = false;
      return;
    }

    let cancelled = false;
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(containerRef.current);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (cancelled || scannedRef.current) return;
            scannedRef.current = true;
            runningRef.current = false;
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {}
        );
        if (!cancelled) runningRef.current = true;
      } catch (err: any) {
        if (!cancelled) {
          setError('לא ניתן לגשת למצלמה. אנא אשר הרשאות מצלמה.');
        }
      }
    };

    const timeout = setTimeout(startScanner, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      setError(null);
    };
  }, [open, onScan]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-4" dir="rtl">
        <DialogHeader>
          <DialogTitle>סרוק QR נוכחות</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">כוון את המצלמה אל קוד ה-QR</p>
          <div id={containerRef.current} className="w-full rounded-lg overflow-hidden" />
          {error && (
            <div className="text-center space-y-2">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>סגור</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
