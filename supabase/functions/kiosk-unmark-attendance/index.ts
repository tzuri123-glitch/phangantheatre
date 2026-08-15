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
    const { pin, admin_user_id, student_id, class_name } = await req.json();

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
      .select('id, class_name')
      .eq('id', student_id)
      .eq('user_id', admin_user_id)
      .maybeSingle();
    if (!student) {
      return new Response(JSON.stringify({ error: 'invalid-student' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = getBangkokDate();

    const { data: session } = await admin
      .from('sessions')
      .select('id')
      .eq('user_id', admin_user_id)
      .eq('session_date', today)
      .eq('class_name', class_name || student.class_name)
      .maybeSingle();

    if (session) {
      await admin.from('attendance')
        .delete()
        .eq('session_id', session.id)
        .eq('student_id', student.id);
    }

    // Cancel a one-time debt that was auto-created today by the kiosk (only if not yet paid)
    const { data: debts } = await admin
      .from('pending_payments')
      .select('id')
      .eq('student_id', student.id)
      .eq('admin_user_id', admin_user_id)
      .eq('payment_type', 'חד פעמי')
      .eq('status', 'pending')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1);

    let cancelledDebt = false;
    if (debts && debts.length > 0) {
      await admin.from('pending_payments')
        .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
        .eq('id', debts[0].id);
      cancelledDebt = true;
    }

    return new Response(JSON.stringify({ ok: true, cancelledDebt }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'unexpected', detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
