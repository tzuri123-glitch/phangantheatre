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

  // בדיקה אם יש מנוי חודשי פעיל
  const target = new Date(targetDate);
  const targetMonth = target.getMonth();
  const targetYear = target.getFullYear();
  
  const hasActiveMonthly = studentPayments.some(payment => {
    if (payment.type !== 'חודשי') return false;
    
    const paymentDate = new Date(payment.date);
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();
    
    // מנוי פעיל אם התשלום באותו חודש או יש יתרה מחודש קודם
    return (paymentYear === targetYear && paymentMonth === targetMonth) ||
           (paymentYear === targetYear && paymentMonth === targetMonth - 1 && balance > 0) ||
           (paymentYear === targetYear - 1 && paymentMonth === 11 && targetMonth === 0 && balance > 0);
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
