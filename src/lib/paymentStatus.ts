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
  const totalPaidLessons = studentPayments.reduce((sum, payment) => {
    if (payment.type === 'ניסיון' || payment.type === 'חד פעמי') {
      return sum + 1;
    } else if (payment.type === 'חודשי') {
      return sum + 4;
    }
    return sum;
  }, 0);

  // ספירת נוכחות - רק "נוכח" נספר
  const attendedCount = sessions.reduce((count, session) => {
    const studentRecord = session.students.find(st => st.studentId === studentId);
    if (studentRecord && studentRecord.status === 'נוכח') {
      return count + 1;
    }
    return count;
  }, 0);

  // חישוב יתרה: תשלומים - נוכחות
  const balance = totalPaidLessons - attendedCount;

  // בדיקה אם יש מנוי חודשי פעיל - תשלום חודשי שעדיין יש לו יתרה
  let hasActiveMonthly = false;
  
  // עבור על כל התשלומים החודשיים
  studentPayments.forEach(payment => {
    if (payment.type === 'חודשי') {
      const paymentDate = new Date(payment.date);
      
      // ספור כמה פעמים היה נוכח אחרי התשלום החודשי הזה
      const attendedAfterPayment = sessions.reduce((count, session) => {
        const sessionDate = new Date(session.date);
        const studentRecord = session.students.find(st => st.studentId === studentId);
        
        if (studentRecord && 
            studentRecord.status === 'נוכח' && 
            sessionDate >= paymentDate) {
          return count + 1;
        }
        return count;
      }, 0);
      
      // אם נוכח פחות מ-4 פעמים מאז התשלום, המנוי עדיין פעיל
      if (attendedAfterPayment < 4) {
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
