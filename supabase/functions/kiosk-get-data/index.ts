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
    }

    return new Response(JSON.stringify({ ok: true, classes, students, arrivedToday, today: getBangkokDate() }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'unexpected' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
