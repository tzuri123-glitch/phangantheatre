import { Payment, Student, Session } from '@/types';

export interface PaymentStatus {
  canAttend: boolean;
  status: 'paid' | 'unpaid' | 'partial';
  message: string;
  balance: number; // יתרה חיובית = זכות, שלילית = חוב
  hasMonthlySubscription: boolean; // האם יש מנוי חודשי פעיל
}

export function getPaymentStatusForDate(
  studentId: string,
  targetDate: string,
  students: Student[],
  payments: Payment[],
  sessions: Session[]
): PaymentStatus {
  const student = students.find(s => s.id === studentId);
  if (!student) {
    return { canAttend: false, status: 'unpaid', message: 'תלמיד לא נמצא', balance: 0, hasMonthlySubscription: false };
  }

  // ספירת תשלומים - כל תשלום = כמות שיעורים ששולמו
  const studentPayments = payments.filter(p => p.studentId === studentId);
  
  let totalCredit = 0; // זכות מתשלומים
  let totalDebt = 0;   // חוב משיעורים

  // חישוב זכות מתשלומים
  studentPayments.forEach(payment => {
    if (payment.type === 'ניסיון' || payment.type === 'חד פעמי') {
      totalCredit += 1;
    } else if (payment.type === 'חודשי') {
      totalCredit += 4;
    }
  });

  // חישוב חוב - ספירת שיעורים שנוצרו בכיתה של התלמיד
  const classSessionsCount = sessions.filter(session => 
    session.className === student.className
  ).length;
  
  totalDebt = classSessionsCount;

  // חישוב יתרה: זכות - חוב
  const balance = totalCredit - totalDebt;

  // בדיקה אם יש מנוי חודשי פעיל
  let hasActiveMonthly = false;
  
  studentPayments.forEach(payment => {
    if (payment.type === 'חודשי') {
      const paymentDate = new Date(payment.date);
      
      // ספור כמה שיעורים של הכיתה נוצרו אחרי התשלום החודשי הזה
      const sessionsAfterPayment = sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return session.className === student.className && 
               sessionDate >= paymentDate;
      }).length;
      
      // אם נוצרו פחות מ-4 שיעורים מאז התשלום, המנוי עדיין פעיל
      if (sessionsAfterPayment < 4) {
        hasActiveMonthly = true;
      }
    }
  });

  // קביעת המסר והסטטוס
  let message: string;
  let canAttend: boolean;
  let status: 'paid' | 'unpaid' | 'partial';

  if (balance > 0) {
    message = `יתרה: ${balance} ${balance === 1 ? 'שיעור' : 'שיעורים'}`;
    canAttend = true;
    status = 'paid';
  } else if (balance === 0) {
    message = 'מאוזן';
    canAttend = true;
    status = 'paid';
  } else {
    message = `חוב: ${Math.abs(balance)} ${Math.abs(balance) === 1 ? 'שיעור' : 'שיעורים'}`;
    canAttend = false;
    status = 'unpaid';
  }

  return {
    canAttend,
    status,
    message,
    balance,
    hasMonthlySubscription: hasActiveMonthly
  };
}
