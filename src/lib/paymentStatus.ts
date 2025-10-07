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
    return { canAttend: false, status: 'unpaid', message: 'לא שילם' };
  }

  const target = new Date(targetDate);

  // מצא את התשלום הרלוונטי האחרון לפני או בתאריך היעד
  const relevantPayments = studentPayments.filter(p => new Date(p.date) <= target);
  
  if (relevantPayments.length === 0) {
    return { canAttend: false, status: 'unpaid', message: 'לא שילם' };
  }

  const lastPayment = relevantPayments[relevantPayments.length - 1];

  // טיפול בתשלומי ניסיון וחד פעמי
  if (lastPayment.type === 'ניסיון' || lastPayment.type === 'חד פעמי') {
    // בדוק אם כבר עבר שיעור אחד מאז התשלום (לא משנה אם היה נוכח)
    const paymentDate = new Date(lastPayment.date);
    
    // מצא שיעורים שהתקיימו אחרי התשלום שהתלמיד רשום אליהם
    const sessionsAfterPayment = sessions.filter(session => {
      const sessionDate = new Date(session.date);
      const isInSession = session.students.some(st => st.studentId === studentId);
      return sessionDate > paymentDate && isInSession;
    });
    
    console.log('[Trial/Single Payment]', {
      studentId,
      paymentDate: lastPayment.date,
      paymentType: lastPayment.type,
      sessionsAfterPayment: sessionsAfterPayment.length,
      sessionDates: sessionsAfterPayment.map(s => s.date)
    });
    
    if (sessionsAfterPayment.length > 0) {
      return { canAttend: false, status: 'unpaid', message: 'צריך לשלם' };
    } else {
      return { 
        canAttend: true, 
        status: 'paid', 
        message: 'שילם', 
        remainingEntries: 1 
      };
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
    
    // ספור שיעורים שהתקיימו באותו חודש (לא משנה אם התלמיד היה נוכח)
    let usedEntries = 0;
    sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      const sessionMonth = sessionDate.getMonth();
      const sessionYear = sessionDate.getFullYear();
      
      // רק שיעורים באותו חודש של התשלום, שהתקיימו אחרי תאריך התשלום
      if (sessionYear === paymentYear && 
          sessionMonth === paymentMonth && 
          sessionDate >= paymentDate &&
          session.students.some(st => st.studentId === studentId)) {
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
          message: 'שילם', 
          remainingEntries 
        };
      } else {
        return { 
          canAttend: false, 
          status: 'unpaid', 
          message: 'צריך לשלם (נוצלו כל הכניסות)' 
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
          message: 'צריך לשלם' 
        };
      }
    }
  }

  return { canAttend: false, status: 'unpaid', message: 'לא שילם' };
}
