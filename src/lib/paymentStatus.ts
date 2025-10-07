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

  // לוגיקה חדשה: עבור כל תשלום נחשב כמה שיעורים הוא מכסה
  const studentPayments = payments.filter(p => p.studentId === studentId);
  
  let totalCredit = 0; // סך שיעורים ששולמו
  let totalDebt = 0;   // סך שיעורים שנוצרו
  
  // עבור על כל תשלום וחשב כמה שיעורים הוא מכסה
  studentPayments.forEach(payment => {
    const paymentDate = new Date(payment.date);
    
    if (payment.type === 'ניסיון' || payment.type === 'חד פעמי') {
      // חד פעמי/ניסיון מכסה שיעור אחד שקורה אחרי התשלום
      totalCredit += 1;
      
      // ספור כמה שיעורים של הכיתה נוצרו אחרי התשלום
      const sessionsAfterPayment = sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return session.className === student.className && sessionDate > paymentDate;
      });
      
      // נספור רק את השיעור הראשון כ"נוצל"
      if (sessionsAfterPayment.length > 0) {
        totalDebt += 1;
      }
      
    } else if (payment.type === 'חודשי') {
      // חודשי מכסה 4 שיעורים באותו חודש
      totalCredit += 4;
      
      const paymentMonth = paymentDate.getMonth();
      const paymentYear = paymentDate.getFullYear();
      
      // ספור כמה שיעורים נוצרו באותו חודש של התשלום
      const sessionsInMonth = sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return session.className === student.className &&
               sessionDate.getMonth() === paymentMonth &&
               sessionDate.getFullYear() === paymentYear &&
               sessionDate >= paymentDate;
      });
      
      totalDebt += sessionsInMonth.length;
    }
  });

  // חישוב יתרה: זכות - חוב
  const balance = totalCredit - totalDebt;

  // בדיקה אם יש מנוי חודשי פעיל
  let hasActiveMonthly = false;
  const target = new Date(targetDate);
  const targetMonth = target.getMonth();
  const targetYear = target.getFullYear();
  
  studentPayments.forEach(payment => {
    if (payment.type === 'חודשי') {
      const paymentDate = new Date(payment.date);
      const paymentMonth = paymentDate.getMonth();
      const paymentYear = paymentDate.getFullYear();
      
      // מנוי פעיל אם התשלום באותו חודש של התאריך המבוקש
      if (paymentMonth === targetMonth && paymentYear === targetYear) {
        // ספור כמה שיעורים של הכיתה נוצרו באותו חודש
        const sessionsInMonth = sessions.filter(session => {
          const sessionDate = new Date(session.date);
          return session.className === student.className &&
                 sessionDate.getMonth() === paymentMonth &&
                 sessionDate.getFullYear() === paymentYear &&
                 sessionDate >= paymentDate;
        }).length;
        
        // אם נוצרו פחות מ-4 שיעורים, המנוי עדיין פעיל
        if (sessionsInMonth < 4) {
          hasActiveMonthly = true;
        }
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
