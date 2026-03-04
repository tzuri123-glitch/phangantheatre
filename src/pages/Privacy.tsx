import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowRight className="ml-2 h-4 w-4" /> חזרה
        </Button>
        <Card className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-foreground">מדיניות פרטיות</h1>

          <div className="prose prose-sm text-foreground space-y-4">
            <p><strong>עדכון אחרון:</strong> מרץ 2026</p>

            <h2 className="text-lg font-semibold mt-6">1. מידע שאנו אוספים</h2>
            <p>אנו אוספים את המידע הבא: שם ההורה, שם התלמיד, מספר טלפון, כתובת אימייל, תאריך לידה, ומידע הקשור לנוכחות ותשלומים.</p>

            <h2 className="text-lg font-semibold mt-6">2. שימוש במידע</h2>
            <p>המידע משמש אך ורק לצורך ניהול חוג התיאטרון: רישום, מעקב נוכחות, ניהול תשלומים ותקשורת עם ההורים.</p>

            <h2 className="text-lg font-semibold mt-6">3. אחסון המידע</h2>
            <p>המידע מאוחסן בשרתים מאובטחים עם הצפנה. הגישה למידע מוגבלת למנהל החוג בלבד. כל התקשורת מוצפנת בפרוטוקול HTTPS.</p>

            <h2 className="text-lg font-semibold mt-6">4. שיתוף מידע</h2>
            <p>אנו לא משתפים, מוכרים או מעבירים מידע אישי לצדדים שלישיים, למעט כנדרש על פי חוק.</p>

            <h2 className="text-lg font-semibold mt-6">5. מידע על קטינים</h2>
            <p>אנו אוספים מידע על קטינים (תלמידים) באישור ובידיעת ההורים בלבד, לצורך ניהול החוג.</p>

            <h2 className="text-lg font-semibold mt-6">6. זכויות המשתמש</h2>
            <p>באפשרותך לבקש לצפות, לתקן או למחוק את המידע האישי שלך בכל עת באמצעות פנייה למנהל החוג.</p>

            <h2 className="text-lg font-semibold mt-6">7. יצירת קשר</h2>
            <p>לכל שאלה בנושא פרטיות, ניתן לפנות למנהל החוג ישירות דרך האפליקציה.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
