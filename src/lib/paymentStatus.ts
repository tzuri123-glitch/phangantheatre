import { Student, Session, Payment } from '@/types';
import { parseISO, isWithinInterval, addDays, subDays, format } from 'date-fns';

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
  subscriptions: Subscription[]
): PaymentStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sessionDate = parseISO(session.date);
  sessionDate.setHours(0, 0, 0, 0);
  
  // Check if trial lesson
  if (student.status === 'חדש' && session.trial) {
    return 'trial';
  }
  
  // Check for active subscription
  const sessionMonthYear = format(sessionDate, 'MM/yyyy');
  const activeSubscription = subscriptions.find(
    sub => sub.studentId === student.id && 
           sub.monthYear === sessionMonthYear && 
           sub.entriesRemaining > 0
  );
  
  // Check for one-time payment within range
  // Can pay before session or up to 2 days after
  const hasOneTimePayment = payments.some(payment => {
    if (payment.studentId !== student.id || payment.type !== 'חד פעמי') {
      return false;
    }
    const paymentDate = parseISO(payment.date);
    paymentDate.setHours(0, 0, 0, 0);
    
    // Check if payment is before session or within 2 days after
    return isWithinInterval(paymentDate, {
      start: subDays(sessionDate, 365), // Can pay in advance
      end: addDays(sessionDate, 2) // Up to 2 days after
    });
  });
  
  const hasPaid = !!activeSubscription || hasOneTimePayment;
  
  // Determine status based on session date vs today
  const isToday = sessionDate.getTime() === today.getTime();
  const isPast = sessionDate < today;
  
  if (isToday) {
    // On session day - show paid (green) or unpaid (red)
    return hasPaid ? 'paid' : 'unpaid';
  } else if (isPast) {
    // Past session - show neutral if paid, red if unpaid (debt)
    return hasPaid ? 'neutral' : 'unpaid';
  }
  
  // Future session - neutral
  return 'neutral';
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
