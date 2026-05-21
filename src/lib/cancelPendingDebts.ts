import { supabase } from '@/integrations/supabase/client';

/**
 * מבטל חיובי 'חד פעמי' ממתינים שנוצרו אוטומטית בקיוסק עבור התלמיד באותו חודש,
 * כאשר נרשם תשלום חודשי שמכסה את אותו חודש.
 * monthDate: תאריך כלשהו בתוך החודש (yyyy-mm-dd).
 * excludeId: pending_payment שכבר עיבדנו (לא לבטל שוב).
 */
export async function cancelMonthOneTimePendingDebts(
  studentId: string,
  monthDate: string,
  excludeId?: string,
): Promise<number> {
  const [y, m] = monthDate.split('-').map(Number);
  if (!y || !m) return 0;
  const lastDay = new Date(y, m, 0).getDate();
  const start = `${y}-${String(m).padStart(2, '0')}-01T00:00:00`;
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

  let q = supabase
    .from('pending_payments')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('payment_type', 'חד פעמי')
    .eq('status', 'pending')
    .gte('created_at', start)
    .lte('created_at', end);

  if (excludeId) q = q.neq('id', excludeId);

  const { data } = await q.select('id');
  return data?.length ?? 0;
}
