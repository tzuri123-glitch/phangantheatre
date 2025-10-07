import { Payment, Student, Session } from '@/types';
import { format, parse, isAfter, isBefore, startOfMonth, endOfMonth } from 'date-fns';

export type PaymentStatus = 'paid' | 'warning' | 'overdue';

export interface PaymentStatusResult {
  status: PaymentStatus;
  message: string;
}

/**
 * מחשב את סטטוס התשלום של תלמיד
 */
export function calculatePaymentStatus(
  student: Student,
  payments: Payment[],
  sessions: Session[],
  currentDate: Date = new Date()
): PaymentStatusResult {
  const studentPayments = payments.filter(p => p.studentId === student.id);
  
  if (studentPayments.length === 0) {
    return { status: 'overdue', message: 'אין תשלומים' };
  }

  // מיון תשלומים לפי סוג
  const monthlyPayments = studentPayments.filter(p => p.type === 'חודשי');
  const singlePayments = studentPayments.filter(p => p.type === 'חד פעמי');
  const trialPayments = studentPayments.filter(p => p.type === 'ניסיון');

  // אם יש תשלום חודשי - בדוק אם יש תשלום לחודש הנוכחי
  if (monthlyPayments.length > 0) {
    const currentMonthStart = startOfMonth(currentDate);
    const currentMonthEnd = endOfMonth(currentDate);
    
    const paidThisMonth = monthlyPayments.some(p => {
      const paymentDate = parse(p.date, 'yyyy-MM-dd', new Date());
      return paymentDate >= currentMonthStart && paymentDate <= currentMonthEnd;
    });

    if (paidThisMonth) {
      return { status: 'paid', message: 'שולם לחודש זה' };
    } else {
      return { status: 'overdue', message: 'לא שולם לחודש זה' };
    }
  }

  // אם יש רק תשלומים חד-פעמיים - בדוק כניסות
  if (singlePayments.length > 0 || trialPayments.length > 0) {
    const allSinglePayments = [...singlePayments, ...trialPayments];
    
    // ספור כמה כניסות התלמיד נכח
    const studentSessions = sessions.filter(s => 
      s.className === student.className &&
      s.students.some(st => st.studentId === student.id && st.status === 'נוכח')
    );

    const attendedCount = studentSessions.length;
    const paidEntriesCount = allSinglePayments.length;
    
    // בדוק אם יש "לא באי" (הקפאות) שלא נספרו
    const frozenSessions = sessions.filter(s =>
      s.students.some(st => st.studentId === student.id && st.status === 'לא באי')
    );

    const balance = paidEntriesCount - attendedCount;

    if (balance > 1) {
      return { status: 'paid', message: `${balance} כניסות נותרות` };
    } else if (balance === 1) {
      return { status: 'warning', message: 'כניסה אחת נותרת' };
    } else if (balance === 0) {
      return { status: 'warning', message: 'אין כניסות נותרות' };
    } else {
      return { status: 'overdue', message: `חוב ${Math.abs(balance)} כניסות` };
    }
  }

  return { status: 'overdue', message: 'לא ברור סטטוס התשלום' };
}

/**
 * מחזיר צבע לפי סטטוס
 */
export function getStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'overdue':
      return 'bg-red-100 text-red-800 border-red-300';
  }
}

/**
 * מחזיר אייקון לפי סטטוס
 */
export function getStatusIcon(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return '✓';
    case 'warning':
      return '⚠';
    case 'overdue':
      return '✗';
  }
}
