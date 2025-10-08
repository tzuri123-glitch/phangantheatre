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
  subscriptions: Subscription[]
): PaymentStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sessionDate = parseISO(session.date);
  sessionDate.setHours(0, 0, 0, 0);
  
  console.log('🔍 Checking payment status for:', student.name, student.lastName);
  console.log('📅 Session date:', session.date);
  console.log('📅 Today:', format(today, 'yyyy-MM-dd'));
  
  // Check if trial lesson
  if (student.status === 'חדש' && session.trial) {
    console.log('✅ Trial lesson');
    return 'trial';
  }
  
  // Check for active subscription
  const sessionMonthYear = format(sessionDate, 'MM/yyyy');
  const activeSubscription = subscriptions.find(
    sub => sub.studentId === student.id && 
           sub.monthYear === sessionMonthYear && 
           sub.entriesRemaining > 0
  );
  
  console.log('💳 Active subscription:', activeSubscription);
  
// Check payments in range (one-time or trial)
const studentPayments = payments.filter(p => p.studentId === student.id && (p.type === 'חד פעמי' || p.type === 'ניסיון' || p.type === 'חודשי'));
console.log('💰 Student payments:', studentPayments.map(p => ({ type: p.type, date: p.date, amount: p.amount, discount: p.discount })));

const hasOneTimeOrTrialPayment = payments.some(payment => {
  if (payment.studentId !== student.id || (payment.type !== 'חד פעמי' && payment.type !== 'ניסיון')) {
    return false;
  }
  const paymentDate = parseISO(payment.date);
  paymentDate.setHours(0, 0, 0, 0);
  
  const inRange = isWithinInterval(paymentDate, {
    start: subDays(sessionDate, 365),
    end: addDays(sessionDate, 2)
  });
  
  if (inRange) {
    console.log('✅ Found one-time/trial payment in range:', payment.type, payment.date, 'discount:', payment.discount);
  }
  
  return inRange;
});

// Check for 100% discount or zero-amount payments near the session date
const has100PercentDiscount = payments.some(payment => {
  if (payment.studentId !== student.id) return false;
  const isFullDiscount = payment.discount === 100 || payment.amount === 0;
  if (!isFullDiscount) return false;
  const paymentDate = parseISO(payment.date);
  paymentDate.setHours(0, 0, 0, 0);
  const inRange = isWithinInterval(paymentDate, {
    start: subDays(sessionDate, 365),
    end: addDays(sessionDate, 365)
  });
  if (inRange) {
    console.log('✅ Found 100% discount/zero-amount payment near session:', payment.date);
  }
  return inRange;
});

// Monthly payment counts for the whole month of the session
const hasMonthlyPayment = payments.some(payment => {
  if (payment.studentId !== student.id || payment.type !== 'חודשי') return false;
  const paymentDate = parseISO(payment.date);
  paymentDate.setHours(0, 0, 0, 0);
  const sameMonth = isSameMonth(paymentDate, sessionDate);
  if (sameMonth) {
    console.log('✅ Found monthly payment for session month:', payment.date);
  }
  return sameMonth;
});

const hasPaid = !!activeSubscription || hasMonthlyPayment || hasOneTimeOrTrialPayment || has100PercentDiscount;
console.log('💵 Has paid:', { hasMonthlyPayment, hasOneTimeOrTrialPayment, has100PercentDiscount, activeSubscription: !!activeSubscription });
  
  // Determine status based on session date vs today
  const isToday = sessionDate.getTime() === today.getTime();
  const isPast = sessionDate < today;
  
  let status: PaymentStatus;
  if (isToday) {
    status = hasPaid ? 'paid' : 'unpaid';
  } else if (isPast) {
    status = hasPaid ? 'neutral' : 'unpaid';
  } else {
    status = 'neutral';
  }
  
  console.log('🎯 Final status:', status);
  console.log('---');
  
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
