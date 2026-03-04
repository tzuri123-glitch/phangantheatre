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
          <h1 className="text-2xl font-bold mb-6 text-foreground">תקנון ותנאי שימוש</h1>

          <div className="prose prose-sm text-foreground space-y-4">
            <p><strong>עדכון אחרון:</strong> מרץ 2026</p>

            <h2 className="text-lg font-semibold mt-6">1. כללי</h2>
            <p>אפליקציה זו מיועדת לניהול חוג תיאטרון, כולל רישום תלמידים, מעקב נוכחות ותשלומים. השימוש באפליקציה כפוף לתנאים המפורטים להלן.</p>

            <h2 className="text-lg font-semibold mt-6">2. הרשמה וחשבון</h2>
            <p>בעת ההרשמה, הנך מתחייב/ת למסור פרטים מדויקים ומעודכנים. אתה אחראי לשמירת סודיות הסיסמה שלך ולכל פעולה שתתבצע תחת חשבונך.</p>

            <h2 className="text-lg font-semibold mt-6">3. שימוש ראוי</h2>
            <p>נאסר להשתמש באפליקציה לכל מטרה בלתי חוקית, לנסות לגשת למידע של משתמשים אחרים, או לשבש את פעילות המערכת.</p>

            <h2 className="text-lg font-semibold mt-6">4. תשלומים</h2>
            <p>האפליקציה מאפשרת מעקב אחר תשלומים ואישורם. תשלומים בפועל מתבצעים מחוץ לאפליקציה. המנהל רשאי לאשר או לדחות בקשות תשלום לפי שיקול דעתו.</p>

            <h2 className="text-lg font-semibold mt-6">5. הגבלת אחריות</h2>
            <p>האפליקציה מסופקת "כמות שהיא" (AS IS). המפעיל אינו אחראי לנזקים ישירים או עקיפים הנובעים משימוש באפליקציה.</p>

            <h2 className="text-lg font-semibold mt-6">6. שינויים בתקנון</h2>
            <p>המפעיל שומר לעצמו את הזכות לעדכן תקנון זה מעת לעת. המשך שימוש באפליקציה לאחר עדכון מהווה הסכמה לתנאים המעודכנים.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
