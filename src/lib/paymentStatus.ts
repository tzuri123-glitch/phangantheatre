import { Student, Session, Payment, isMonthlyPaymentType, getPaymentPrice } from '@/types';
import { parseISO, format, isSameMonth } from 'date-fns';

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
  if (attendanceStatus === 'לא הגיע' || attendanceStatus === 'לא באי') {
    return 'neutral';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sessionDate = parseISO(session.date);
  sessionDate.setHours(0, 0, 0, 0);
  
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

  // Check one-time payments for exact session date
  const hasOneTimePayment = payments.some(payment => {
    if (payment.studentId !== student.id || payment.type !== 'חד פעמי') return false;
    
    const paymentDate = parseISO(payment.date);
    paymentDate.setHours(0, 0, 0, 0);
    
    const isExactMatch = paymentDate.getTime() === sessionDate.getTime();
    if (!isExactMatch) return false;
    
    const requiredAmount = student.isSibling ? 700 : 800;
    const effectiveAmount = payment.amount * (1 - (payment.discount || 0) / 100);
    const isFullDiscount = payment.discount === 100;
    return effectiveAmount >= requiredAmount || isFullDiscount;
  });

  // Check for 100% discount payments for the exact session date
  const has100PercentDiscount = payments.some(payment => {
    if (payment.studentId !== student.id) return false;
    if (payment.discount !== 100) return false;
    
    const paymentDate = parseISO(payment.date);
    paymentDate.setHours(0, 0, 0, 0);
    return paymentDate.getTime() === sessionDate.getTime();
  });

  // Monthly payment covers the whole month of the session
  const hasMonthlyPayment = payments.some(payment => {
    if (payment.studentId !== student.id || !isMonthlyPaymentType(payment.type)) return false;
    const paymentDate = parseISO(payment.date);
    paymentDate.setHours(0, 0, 0, 0);
    return isSameMonth(paymentDate, sessionDate);
  });

  const hasPaid = !!activeSubscription || hasMonthlyPayment || hasOneTimePayment || has100PercentDiscount;
  
  const isToday = sessionDate.getTime() === today.getTime();
  const isPast = sessionDate < today;
  
  let status: PaymentStatus;
  if (isToday) {
    status = hasPaid ? 'paid' : 'unpaid';
  } else if (isPast) {
    status = hasPaid ? 'neutral' : 'unpaid';
  } else {
    status = hasPaid ? 'paid' : 'unpaid';
  }
  
  return status;
}

export function getStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'trial':
      return 'bg-yellow-900/30';
    case 'paid':
      return 'bg-emerald-900/30';
    case 'unpaid':
      return 'bg-red-900/30';
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
