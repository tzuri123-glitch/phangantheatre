import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

export default function PrintAttendanceQr() {
  const qrUrl = `${window.location.origin}/mark-attendance`;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8" dir="rtl">
      <div className="text-center max-w-md">
        <div className="print:hidden mb-6">
          <Button onClick={() => window.print()} className="mb-4">🖨️ הדפס</Button>
          <Button variant="outline" onClick={() => window.history.back()} className="mr-2 mb-4">חזור</Button>
        </div>

        <div className="border-4 border-foreground rounded-3xl p-8 inline-block">
          <img src={logo} alt="לוגו" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-foreground mb-2">סרוק לרישום נוכחות</h1>
          <p className="text-muted-foreground mb-6 text-lg">כוון את המצלמה אל הקוד</p>
          <div className="bg-white p-6 rounded-2xl inline-block shadow-lg">
            <QRCodeSVG value={qrUrl} size={280} level="H" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">מרכז אומנויות הבמה</p>
        </div>
      </div>
    </div>
  );
}
