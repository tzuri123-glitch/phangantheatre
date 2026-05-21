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
  // today is YYYY-MM-DD
  const [y, m] = today.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
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

    // Validate student belongs to admin and class
    const { data: student } = await admin
      .from('students')
      .select('id, name, last_name, profile_photo_url, class_name, status, is_sibling, user_id')
      .eq('id', student_id)
      .eq('user_id', admin_user_id)
      .maybeSingle();
    if (!student || student.class_name !== class_name) {
      return new Response(JSON.stringify({ error: 'invalid-student' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = getBangkokDate();

    // Find or create today's session
    let { data: session } = await admin
      .from('sessions')
      .select('id')
      .eq('user_id', admin_user_id)
      .eq('session_date', today)
      .eq('class_name', class_name)
      .maybeSingle();
    if (!session) {
      const { data: newSession } = await admin
        .from('sessions')
        .upsert({
          user_id: admin_user_id,
          session_date: today,
          class_name,
          is_trial: false,
        }, { onConflict: 'user_id,session_date,class_name' })
        .select('id').single();
      session = newSession;
    }
    if (!session) {
      return new Response(JSON.stringify({ error: 'session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check existing attendance
    const { data: existing } = await admin
      .from('attendance')
      .select('id, status')
      .eq('session_id', session.id)
      .eq('student_id', student.id)
      .maybeSingle();

    let already = false;
    if (existing) {
      already = existing.status === 'נוכח';
      if (!already) {
        await admin.from('attendance').update({ status: 'נוכח' }).eq('id', existing.id);
      }
    } else {
      await admin.from('attendance').insert({
        user_id: admin_user_id,
        session_id: session.id,
        student_id: student.id,
        status: 'נוכח',
      });
    }

    // Determine if student has active monthly subscription covering this month
    let createdDebt = false;
    let debtAmount = 0;
    if (!already && student.status !== 'בהקפאה') {
      const { start, end } = currentMonthRange(today);

      const { data: monthly } = await admin
        .from('payments')
        .select('id')
        .eq('student_id', student.id)
        .eq('payment_type', 'חודשי')
        .gte('payment_date', start)
        .lte('payment_date', end)
        .limit(1);

      const { data: pendingMonthly } = await admin
        .from('pending_payments')
        .select('id')
        .eq('student_id', student.id)
        .eq('payment_type', 'חודשי')
        .in('status', ['pending', 'approved'])
        .gte('created_at', `${start}T00:00:00`)
        .limit(1);

      const hasMonthly = (monthly && monthly.length > 0) || (pendingMonthly && pendingMonthly.length > 0);

      if (!hasMonthly) {
        // Avoid duplicate one-time debt for the same day
        const { data: existingOneTime } = await admin
          .from('pending_payments')
          .select('id')
          .eq('student_id', student.id)
          .eq('payment_type', 'חד פעמי')
          .eq('status', 'pending')
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`)
          .limit(1);

        if (!existingOneTime || existingOneTime.length === 0) {
          debtAmount = student.is_sibling ? 700 : 800;
          await admin.from('pending_payments').insert({
            student_id: student.id,
            admin_user_id,
            payment_type: 'חד פעמי',
            payment_method: 'מזומן',
            amount: debtAmount,
            status: 'pending',
          });
          createdDebt = true;
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      already,
      student: {
        id: student.id,
        name: student.name,
        last_name: student.last_name,
        profile_photo_url: student.profile_photo_url,
      },
      createdDebt,
      debtAmount,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'unexpected', detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
