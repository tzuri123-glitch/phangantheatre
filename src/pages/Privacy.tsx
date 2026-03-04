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
            <h2 className="text-lg font-semibold mt-6">1. המידע שאנו אוספים</h2>
            <p>אנו אוספים מידע מינימלי הנחוץ לתפעול השירות:</p>
            <ul className="list-disc pr-6 space-y-1">
              <li><strong>פרטי זיהוי:</strong> שם מלא, תאריך לידה (לתלמיד), טלפון וכתובת דואר אלקטרוני.</li>
              <li><strong>נתוני פעילות:</strong> נוכחות בשיעורים, היסטוריית תשלומים והודעות מערכת.</li>
              <li><strong>תוכן ויזואלי:</strong> סרטוני וידאו ותמונות מהפעילות בחוגים המועלים לצורך משוב ולמידה.</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">2. השימוש במידע ובמדיה</h2>
            <p>המידע משמש לצרכים הבאים בלבד:</p>
            <ul className="list-disc pr-6 space-y-1">
              <li>ניהול אדמיניסטרטיבי ותקשורת מול הורי התלמידים.</li>
              <li>יצירת "תיק עבודות דיגיטלי" (Portfolio) המאפשר לתלמיד לעקוב אחר התקדמותו.</li>
              <li>שיפור תהליכי הלמידה באמצעות ניתוח סרטוני חזרות ושיעורים.</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">3. פרטיות קטינים והגנה מוגברת</h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>האפליקציה משרתת קטינים, ולכן הרישום מותנה באישור הורה/אפוטרופוס.</li>
              <li>גישה לסרטונים המכילים קטינים מוגבלת לקבוצת החוג הרלוונטית בלבד (Access-Controlled) ואינה חשופה לכלל משתמשי האפליקציה.</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">4. אבטחת מידע ושיתוף צד ג׳</h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>כל המידע נשמר על שרתים מאובטחים תוך שימוש בפרוטוקול HTTPS להצפנת הנתונים.</li>
              <li>המרכז לא ימכור או יעביר את פרטיכם האישיים לצדדים שלישיים, למעט ספקי שירות טכנולוגיים (כמו שרתי אחסון או חברת סליקה) הנדרשים להפעלת האפליקציה.</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">5. זכות לעיון ומחיקת מידע</h2>
            <p>הורה רשאי לבקש בכל עת לעיין במידע השמור על ילדו או לבקש את מחיקת חשבון האפליקציה ותכני המדיה המשויכים אליו, בכפוף לסיום ההתחייבויות המנהלתיות מול המרכז.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
