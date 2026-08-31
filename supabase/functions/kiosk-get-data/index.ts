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

function currentMonthRange(today: string): { start: string; end: string } {
  const [y, m] = today.split('-').map(Number);
  let py = y;
  let pm = m - 1;
  if (pm < 1) { pm = 12; py -= 1; }
  const start = `${py}-${String(pm).padStart(2, '0')}-25`;
  const end = `${y}-${String(m).padStart(2, '0')}-24`;
  return { start, end };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { pin, admin_user_id, class_name } = await req.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const hash = await sha256(String(pin || '').trim());
    const { data: settings } = await admin
      .from('kiosk_settings').select('user_id').eq('user_id', admin_user_id).eq('pin_hash', hash).maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ error: 'auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All classes for this admin (distinct)
    const { data: classRows } = await admin
      .from('students').select('class_name').eq('user_id', admin_user_id);
    const classes = Array.from(new Set((classRows || []).map(r => r.class_name))).sort();

    let students: any[] = [];
    let arrivedToday: any[] = [];
    let openDebts: any[] = [];
    if (class_name) {
      const { data: studs } = await admin
        .from('students')
        .select('id, name, last_name, profile_photo_url, status, is_sibling, class_name')
        .eq('user_id', admin_user_id)
        .eq('class_name', class_name)
        .order('name');
      students = studs || [];

      const today = getBangkokDate();
      const { data: session } = await admin
        .from('sessions')
        .select('id')
        .eq('user_id', admin_user_id)
        .eq('session_date', today)
        .eq('class_name', class_name)
        .maybeSingle();
      if (session) {
        const { data: att } = await admin
          .from('attendance')
          .select('student_id, created_at')
          .eq('session_id', session.id);
        arrivedToday = att || [];
      }

      const ids = students.map((s: any) => s.id);
      if (ids.length > 0) {
        const { data: debts } = await admin
          .from('pending_payments')
          .select('id, student_id, amount, created_at')
          .eq('admin_user_id', admin_user_id)
          .eq('payment_type', 'חד פעמי')
          .eq('status', 'pending')
          .in('student_id', ids);
        openDebts = debts || [];

        // Precompute per-student expected one-time charge so the kiosk can react instantly
        const { start, end } = currentMonthRange(today);
        const { data: monthlyPaid } = await admin
          .from('payments')
          .select('student_id')
          .in('student_id', ids)
          .eq('payment_type', 'חודשי')
          .gte('payment_date', start)
          .lte('payment_date', end);
        const { data: monthlyPending } = await admin
          .from('pending_payments')
          .select('student_id')
          .in('student_id', ids)
          .eq('payment_type', 'חודשי')
          .in('status', ['pending', 'approved'])
          .gte('created_at', `${start}T00:00:00`);
        const withMonthly = new Set([
          ...(monthlyPaid || []).map((r: any) => r.student_id),
          ...(monthlyPending || []).map((r: any) => r.student_id),
        ]);
        const { data: priceRows } = await admin
          .from('students')
          .select('id, is_sibling, custom_single_price, status')
          .in('id', ids);
        const priceById = new Map((priceRows || []).map((r: any) => [r.id, r]));
        students = students.map((s: any) => {
          const p = priceById.get(s.id);
          const frozen = (p?.status || s.status) === 'בהקפאה';
          const price = p?.custom_single_price != null
            ? Number(p.custom_single_price)
            : (p?.is_sibling ? 700 : 800);
          return {
            ...s,
            has_monthly: withMonthly.has(s.id),
            expected_debt: withMonthly.has(s.id) || frozen ? 0 : price,
          };
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, classes, students, arrivedToday, openDebts, today: getBangkokDate() }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'unexpected' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
