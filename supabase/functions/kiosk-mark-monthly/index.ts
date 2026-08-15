import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getBangkokDate(): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// החודש שהתשלום מכסה: תשלום מה-25 ואילך מיוחס לחודש הבא
function coveredMonth(dateISO: string): { year: number; month: number } {
  const [y, m, d] = dateISO.split('-').map(Number);
  let year = y;
  let month = m;
  if (d >= 25) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return { year, month };
}

// טווח תאריכי תשלום/חוב שמיוחסים לחודש: 25 בחודש הקודם עד 24 בחודש עצמו
function monthRange(year: number, month: number): { start: string; end: string } {
  let py = year;
  let pm = month - 1;
  if (pm < 1) { pm = 12; py -= 1; }
  return {
    start: `${py}-${String(pm).padStart(2, '0')}-25`,
    end: `${year}-${String(month).padStart(2, '0')}-24`,
  };
}

const PRICES: Record<string, { regular: number; sibling: number }> = {
  biweekly: { regular: 4200, sibling: 3900 },
  weekly: { regular: 3000, sibling: 2700 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { pin, admin_user_id, student_id, payment_method, frequency, discount } = await req.json();

    const freq = frequency === 'weekly' ? 'weekly' : 'biweekly';

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const hash = await sha256(String(pin || '').trim());
    const { data: settings } = await admin
      .from('kiosk_settings').select('user_id').eq('user_id', admin_user_id).eq('pin_hash', hash).maybeSingle();
    if (!settings) return json({ error: 'auth' }, 401);

    const { data: student } = await admin
      .from('students')
      .select('id, is_sibling')
      .eq('id', student_id)
      .eq('user_id', admin_user_id)
      .maybeSingle();
    if (!student) return json({ error: 'invalid-student' }, 400);

    const today = getBangkokDate();
    const method = payment_method === 'סקאן' ? 'סקאן' : 'מזומן';
    const base = student.is_sibling ? PRICES[freq].sibling : PRICES[freq].regular;
    const disc = Math.max(0, Math.min(base, Number(discount) || 0));
    const amount = base - disc;

    // רישום התשלום החודשי
    const { error: payErr } = await admin.from('payments').insert({
      user_id: admin_user_id,
      student_id: student.id,
      payment_type: 'חודשי',
      payment_method: method,
      payment_date: today,
      amount,
      discount: disc,
      subscription_frequency: freq,
      note: 'שולם בקיוסק',
    });
    if (payErr) return json({ error: 'insert-failed', detail: payErr.message }, 500);

    // ביטול חובות חד-פעמיים פתוחים שמיוחסים לאותו חודש מכוסה
    const { year, month } = coveredMonth(today);
    const { start, end } = monthRange(year, month);
    const { data: cancelled } = await admin
      .from('pending_payments')
      .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
      .eq('student_id', student.id)
      .eq('admin_user_id', admin_user_id)
      .eq('payment_type', 'חד פעמי')
      .eq('status', 'pending')
      .gte('created_at', `${start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59`)
      .select('id');

    return json({
      ok: true,
      amount,
      discount: disc,
      method,
      frequency: freq,
      cancelledDebts: (cancelled || []).length,
    });
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500);
  }
});
