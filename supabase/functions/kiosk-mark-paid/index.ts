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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { pin, admin_user_id, student_id, payment_method } = await req.json();

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

    const { data: student } = await admin
      .from('students')
      .select('id, is_sibling')
      .eq('id', student_id)
      .eq('user_id', admin_user_id)
      .maybeSingle();
    if (!student) {
      return new Response(JSON.stringify({ error: 'invalid-student' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = getBangkokDate();

    // Find the oldest open one-time debt for this student
    const { data: debts } = await admin
      .from('pending_payments')
      .select('id, amount, payment_method')
      .eq('student_id', student.id)
      .eq('admin_user_id', admin_user_id)
      .eq('payment_type', 'חד פעמי')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    const debt = debts && debts[0];
    if (!debt) {
      return new Response(JSON.stringify({ error: 'no-debt' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amount = Number(debt.amount || (student.is_sibling ? 700 : 800));
    const method = payment_method || debt.payment_method || 'מזומן';

    await admin.from('pending_payments').update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
      amount,
      payment_method: method,
    }).eq('id', debt.id);

    await admin.from('payments').insert({
      user_id: admin_user_id,
      student_id: student.id,
      payment_type: 'חד פעמי',
      payment_method: method,
      payment_date: today,
      amount,
      note: 'שולם בקיוסק',
    });

    return new Response(JSON.stringify({ ok: true, amount, method }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'unexpected', detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
