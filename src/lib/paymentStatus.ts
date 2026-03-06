import { Student, Session, Payment } from '@/types';
import { parseISO, isWithinInterval, addDays, subDays, format, isSameMonth } from 'date-fns';

export type PaymentStatus = 'trial' | 'paid' | 'unpaid' | 'neutral';

interface Subscription {
  id: string;
  studentId: string;
  monthYear: string;
  totalEntries: number;
  entriesRemaining: number;
}

export function getPaymentStatusForSession(
  student: Student,
  session: Session,
  payments: Payment[],
  subscriptions: Subscription[],
  attendanceStatus?: 'נוכח' | 'לא הגיע' | 'לא באי' | 'עזב' | ''
): PaymentStatus {
  // אם התלמיד לא הגיע או לא באי - תמיד neutral (לא חייב)
  if (attendanceStatus === 'לא הגיע' || attendanceStatus === 'לא באי') {
    return 'neutral';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sessionDate = parseISO(session.date);
  sessionDate.setHours(0, 0, 0, 0);
  
  // Check if student is frozen - not charged
  if (student.status === 'בהקפאה') {
    return 'neutral';
  }
  
  // Check for active subscription
  const sessionMonthYear = format(sessionDate, 'MM/yyyy');
  const activeSubscription = subscriptions.find(
    sub => sub.studentId === student.id && 
           sub.monthYear === sessionMonthYear && 
           sub.entriesRemaining > 0
  );

// Check payments in range (one-time or trial)
const studentPayments = payments.filter(p => p.studentId === student.id && (p.type === 'חד פעמי' || p.type === 'חודשי'));

// One-time and trial payments cover ONLY the specific session date, not a range
const hasOneTimeOrTrialPayment = payments.some(payment => {
  if (payment.studentId !== student.id || payment.type !== 'חד פעמי') {
    return false;
  }
  
  const paymentDate = parseISO(payment.date);
  paymentDate.setHours(0, 0, 0, 0);
  
  // One-time/trial payment must match the exact session date
  const isExactMatch = paymentDate.getTime() === sessionDate.getTime();
  if (!isExactMatch) return false;
  
  // Check if payment amount is sufficient or has 100% discount
  const requiredAmount = student.isSibling ? 500 : 700;
  const effectiveAmount = payment.amount * (1 - (payment.discount || 0) / 100);
  const isFullDiscount = payment.discount === 100;
  const isPaidEnough = effectiveAmount >= requiredAmount || isFullDiscount;
  
  return isPaidEnough;
});

// Check for 100% discount payments for the exact session date
const has100PercentDiscount = payments.some(payment => {
  if (payment.studentId !== student.id) return false;
  
  // Only 100% discount counts as payment - amount 0 without discount is NOT a payment
  const isFullDiscount = payment.discount === 100;
  if (!isFullDiscount) return false;
  
  const paymentDate = parseISO(payment.date);
  paymentDate.setHours(0, 0, 0, 0);
  
  // 100% discount must match the exact session date
  const isExactMatch = paymentDate.getTime() === sessionDate.getTime();
  return isExactMatch;
});

// Monthly payment counts for the whole month of the session
const hasMonthlyPayment = payments.some(payment => {
  if (payment.studentId !== student.id || payment.type !== 'חודשי') return false;
  const paymentDate = parseISO(payment.date);
  paymentDate.setHours(0, 0, 0, 0);
  return isSameMonth(paymentDate, sessionDate);
});

const hasPaid = !!activeSubscription || hasMonthlyPayment || hasOneTimeOrTrialPayment || has100PercentDiscount;
  
  // Determine status based on session date vs today
  const isToday = sessionDate.getTime() === today.getTime();
  const isPast = sessionDate < today;
  
  let status: PaymentStatus;
  if (isToday) {
    status = hasPaid ? 'paid' : 'unpaid';
  } else if (isPast) {
    status = hasPaid ? 'neutral' : 'unpaid';
  } else {
    // For future sessions: show preview so you can see debts in advance
    status = hasPaid ? 'paid' : 'unpaid';
  }
  
  return status;
}

export function getStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'trial':
      return 'bg-yellow-100 dark:bg-yellow-900/20';
    case 'paid':
      return 'bg-green-100 dark:bg-green-900/20';
    case 'unpaid':
      return 'bg-red-100 dark:bg-red-900/20';
    case 'neutral':
      return '';
  }
}

export function getStatusBadge(status: PaymentStatus): string {
  switch (status) {
    case 'trial':
      return '🟡 ניסיון';
    case 'paid':
      return '🟢 שילם';
    case 'unpaid':
      return '🔴 לא שילם';
    case 'neutral':
      return '';
  }
}
