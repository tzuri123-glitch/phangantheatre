import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the user's JWT from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'לא מחובר' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create a client with the user's JWT to get their identity
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'אימות נכשל' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role client for all DB operations (bypass RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find student linked to this auth user
    const { data: student, error: studentError } = await adminClient
      .from('students')
      .select('id, name, last_name, class_name, user_id, is_sibling')
      .eq('auth_user_id', user.id)
      .limit(1)
      .single();

    if (studentError || !student) {
      return new Response(JSON.stringify({ error: 'no-student', message: 'החשבון לא מקושר לתלמיד' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminUserId = student.user_id;
    const today = new Date().toISOString().slice(0, 10);

    // Find today's session for this student's class
    let { data: session } = await adminClient
      .from('sessions')
      .select('id')
      .eq('user_id', adminUserId)
      .eq('session_date', today)
      .eq('class_name', student.class_name)
      .limit(1)
      .single();

    // Auto-create session if none exists for today
    if (!session) {
      const { data: newSession, error: sessionError } = await adminClient
        .from('sessions')
        .insert({
          user_id: adminUserId,
          session_date: today,
          class_name: student.class_name,
          is_trial: false,
        })
        .select('id')
        .single();

      if (sessionError || !newSession) {
        return new Response(JSON.stringify({ error: 'session-error', message: 'שגיאה ביצירת שיעור' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      session = newSession;
    }

    // Check if already marked
    const { data: existing } = await adminClient
      .from('attendance')
      .select('id, status')
      .eq('session_id', session.id)
      .eq('student_id', student.id)
      .limit(1)
      .single();

    if (existing) {
      if (existing.status === 'נוכח') {
        return new Response(JSON.stringify({
          status: 'already',
          message: `${student.name} ${student.last_name || ''} - כבר סומנת כנוכח/ת! 👋`,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Update existing record
      await adminClient
        .from('attendance')
        .update({ status: 'נוכח' })
        .eq('id', existing.id);

      return new Response(JSON.stringify({
        status: 'success',
        message: `${student.name} ${student.last_name || ''} - נוכחות עודכנה בהצלחה! ✅`,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert new attendance record with admin's user_id
    const { error: attendanceError } = await adminClient
      .from('attendance')
      .insert({
        user_id: adminUserId,
        session_id: session.id,
        student_id: student.id,
        status: 'נוכח',
      });

    if (attendanceError) {
      return new Response(JSON.stringify({ error: 'attendance-error', message: 'שגיאה ברישום נוכחות' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if student has active monthly payment for this month
    const monthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const { data: monthlyPayment } = await adminClient
      .from('payments')
      .select('id')
      .eq('student_id', student.id)
      .eq('payment_type', 'חודשי')
      .gte('payment_date', `${monthYear}-01`)
      .lte('payment_date', `${monthYear}-31`)
      .limit(1)
      .single();

    let paymentNote = '';
    if (!monthlyPayment) {
      // Check if already has a pending single payment for today
      const { data: existingPending } = await adminClient
        .from('pending_payments')
        .select('id')
        .eq('student_id', student.id)
        .eq('payment_type', 'חד פעמי')
        .eq('status', 'pending')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .limit(1)
        .single();

      if (!existingPending) {
        await adminClient
          .from('pending_payments')
          .insert({
            student_id: student.id,
            admin_user_id: adminUserId,
            payment_type: 'חד פעמי',
            payment_method: 'מזומן',
            status: 'pending',
          });
        paymentNote = '\n💰 נוצר חיוב תשלום חד פעמי';
      }
    }

    return new Response(JSON.stringify({
      status: 'success',
      message: `${student.name} ${student.last_name || ''} - נרשמת בהצלחה! ✅${paymentNote}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'unexpected', message: 'שגיאה לא צפויה' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
