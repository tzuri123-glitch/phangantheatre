import { Payment, Student, Session } from '@/types';

export interface PaymentStatus {
  canAttend: boolean; // האם יכול להיכנס לשיעור
  status: 'paid' | 'unpaid' | 'partial';
  message: string;
  remainingEntries?: number; // כניסות שנותרו במנוי חודשי
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
    return { canAttend: false, status: 'unpaid', message: 'תלמיד לא נמצא' };
  }

  console.log('[getPaymentStatusForDate]', { studentId, targetDate, paymentsCount: payments.filter(p => p.studentId === studentId).length });

  // מיון תשלומים לפי תאריך
  const studentPayments = payments
    .filter(p => p.studentId === studentId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (studentPayments.length === 0) {
    return { canAttend: false, status: 'unpaid', message: 'נדרש תשלום' };
  }

  const target = new Date(targetDate);

  // מצא את התשלום הרלוונטי האחרון לפני או בתאריך היעד
  const relevantPayments = studentPayments.filter(p => new Date(p.date) <= target);
  
  if (relevantPayments.length === 0) {
    return { canAttend: false, status: 'unpaid', message: 'נדרש תשלום' };
  }

  const lastPayment = relevantPayments[relevantPayments.length - 1];

  // טיפול בתשלומי ניסיון וחד פעמי
  if (lastPayment.type === 'ניסיון' || lastPayment.type === 'חד פעמי') {
    const paymentDate = new Date(lastPayment.date);

    // האם התקיים שיעור בכיתה של התלמיד אחרי התשלום ועד התאריך המבוקש
    const sessionsAfterPaymentForClass = sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return (
        session.className === student.className &&
        sessionDate > paymentDate &&
        sessionDate <= target
      );
    });

    // אם לא נרשמו שיעורים - נ fallback לחוק שבוע
    const msInDay = 24 * 60 * 60 * 1000;
    const daysSincePayment = Math.floor((target.getTime() - paymentDate.getTime()) / msInDay);
    const usedEntry = sessionsAfterPaymentForClass.length > 0 || daysSincePayment >= 7;

    if (usedEntry) {
      return { canAttend: false, status: 'unpaid', message: 'נדרש תשלום' };
    } else {
      return { canAttend: true, status: 'paid', message: 'רשאי להשתתף', remainingEntries: 1 };
    }
  }

  // טיפול בתשלום חודשי
  if (lastPayment.type === 'חודשי') {
    const paymentDate = new Date(lastPayment.date);
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();
    
    // בדוק אם התאריך היעד באותו חודש של התשלום
    const targetMonth = target.getMonth();
    const targetYear = target.getFullYear();
    
    let usedEntries = 0;
    sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      const sessionMonth = sessionDate.getMonth();
      const sessionYear = sessionDate.getFullYear();
      
      // רק שיעורי הכיתה של התלמיד באותו חודש של התשלום, שהתקיימו אחרי התשלום ועד התאריך המבוקש
      if (
        session.className === student.className &&
        sessionYear === paymentYear &&
        sessionMonth === paymentMonth &&
        sessionDate >= paymentDate &&
        sessionDate <= target
      ) {
        usedEntries++;
      }
    });

    const remainingEntries = 4 - usedEntries;

    // אם באותו חודש של התשלום
    if (targetYear === paymentYear && targetMonth === paymentMonth) {
      if (remainingEntries > 0) {
        return { 
          canAttend: true, 
          status: 'paid', 
          message: 'רשאי להשתתף', 
          remainingEntries 
        };
      } else {
        return { 
          canAttend: false, 
          status: 'unpaid', 
          message: 'נדרש תשלום (נוצלו כל הכניסות)' 
        };
      }
    }
    
    // אם בחודש שאחרי - בדוק אם יש כניסות שנותרו מהחודש הקודם
    if (targetYear > paymentYear || (targetYear === paymentYear && targetMonth > paymentMonth)) {
      if (remainingEntries > 0) {
        return { 
          canAttend: true, 
          status: 'paid', 
          message: `יתרה מחודש קודם (${remainingEntries} כניסות)`, 
          remainingEntries 
        };
      } else {
        return { 
          canAttend: false, 
          status: 'unpaid', 
          message: 'נדרש תשלום' 
        };
      }
    }
  }

  return { canAttend: false, status: 'unpaid', message: 'נדרש תשלום' };
}
