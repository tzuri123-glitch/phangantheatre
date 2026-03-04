import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowRight className="ml-2 h-4 w-4" /> חזרה
        </Button>
        <Card className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-foreground">תקנון ותנאי שימוש באפליקציה</h1>

          <div className="prose prose-sm text-foreground space-y-4">
            <h2 className="text-lg font-semibold mt-6">1. כללי</h2>
            <p>ברוכים הבאים לאפליקציית הניהול של מרכז אומנויות הבמה קופנגן. האפליקציה נועדה לניהול שוטף, מעקב נוכחות, תשלומים ושיתוף תכני למידה בין המרכז לבין התלמידים והוריהם. השימוש באפליקציה מהווה הסכמה מלאה לתנאים המפורטים להלן.</p>

            <h2 className="text-lg font-semibold mt-6">2. רישום ואבטחת חשבון</h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>המשתמש מתחייב למסור פרטים נכונים ומדויקים בעת הרישום.</li>
              <li>האחריות על שמירת סודיות הסיסמה חלה על המשתמש בלבד. אין להעביר פרטי גישה לצד ג׳.</li>
              <li>המערכת תבצע ניתוק אוטומטי לאחר תקופת חוסר פעילות מטעמי אבטחה.</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">3. שימוש במדיה ותיעוד (וידאו וסטילס)</h2>
            <p>כמרכז לאמנויות הבמה, תיעוד חזותי הוא חלק בלתי נפרד מתהליך הלמידה:</p>
            <ul className="list-disc pr-6 space-y-1">
              <li><strong>צילום פעילות:</strong> המשתמש (או הוריו במקרה של קטין) מאשר כי המרכז רשאי לתעד שיעורים, חזרות ומופעים.</li>
              <li><strong>זכויות יוצרים:</strong> כל תוכן מדיה (סרטונים, תמונות, פלייבקים) המועלה לאפליקציה הוא רכוש המרכז ומוגן בזכויות יוצרים.</li>
              <li><strong>איסור הפצה:</strong> חל איסור מוחלט להוריד, להעתיק או להפיץ סרטונים ותמונות מהאפליקציה הכוללים תלמידים אחרים ללא אישור בכתב מהנהלת המרכז. שימוש לא מורשה במדיה של קטינים עלול להוביל לחסימת המשתמש ולנקיטת צעדים משפטיים.</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">4. תשלומים וביטולים</h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>סטטוס התשלומים המוצג באפליקציה הוא המדד הרשמי לחובות וזכויות התלמיד.</li>
              <li>סליקת התשלומים מתבצעת דרך ספק חיצוני מאובטח בתקן PCI. המרכז אינו שומר את פרטי האשראי במערכות האפליקציה.</li>
              <li>ביטול השתתפות בחוגים כפוף למדיניות הביטולים הכללית של המרכז כפי שנחתמה במועד הרישום הפיזי.</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
