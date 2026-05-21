import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schedule definition: day of week (0=Sun) => class schedules
const CLASS_SCHEDULE: Record<string, { day: number; startHour: number; startMin: number; endHour: number; endMin: number }[]> = {
  'תיאטרון 7-9': [
    { day: 0, startHour: 11, startMin: 30, endHour: 13, endMin: 30 },  // Sunday
    { day: 2, startHour: 16, startMin: 30, endHour: 18, endMin: 30 },  // Tuesday
    { day: 4, startHour: 2, startMin: 0, endHour: 4, endMin: 0 },      // Thursday (test)
  ],
  'תיאטרון 10-14': [
    { day: 0, startHour: 15, startMin: 0, endHour: 17, endMin: 0 },    // Sunday
    { day: 4, startHour: 18, startMin: 30, endHour: 20, endMin: 30 },  // Thursday
  ],
};

function getBangkokTimeInfo(): { dayOfWeek: number; hour: number; minute: number; date: string; timeLabel: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const dayOfWeek = weekdayMap[get('weekday')] ?? -1;
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const date = `${get('year')}-${get('month')}-${get('day')}`;

  return { dayOfWeek, hour, minute, date, timeLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

function findCurrentSession(className: string, dayOfWeek: number, hour: number, minute: number): { startHour: number; startMin: number } | null {
  const schedule = CLASS_SCHEDULE[className];
  if (!schedule) return null;

  const currentMinutes = hour * 60 + minute;

  for (const slot of schedule) {
    if (slot.day !== dayOfWeek) continue;

    const startMinutes = slot.startHour * 60 + slot.startMin;
    const endMinutes = slot.endHour * 60 + slot.endMin;

    // Allow scanning from start time to end time (student may arrive late)
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return slot;
    }
  }

  return null;
}

function getDayName(day: number): string {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[day];
}

function getNextClassInfo(className: string): string {
  const schedule = CLASS_SCHEDULE[className];
  if (!schedule || schedule.length === 0) return '';
  
  const lines = schedule.map(s => 
    `יום ${getDayName(s.day)} ${String(s.startHour).padStart(2, '0')}:${String(s.startMin).padStart(2, '0')}-${String(s.endHour).padStart(2, '0')}:${String(s.endMin).padStart(2, '0')}`
  );
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'לא מחובר' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find student
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

    // Check schedule - Bangkok timezone (server-safe calculation)
    const bangkokTime = getBangkokTimeInfo();
    const currentSlot = findCurrentSession(
      student.class_name,
      bangkokTime.dayOfWeek,
      bangkokTime.hour,
      bangkokTime.minute,
    );

    if (!currentSlot) {
      const scheduleInfo = getNextClassInfo(student.class_name);
      return new Response(JSON.stringify({
        error: 'no-class-now',
        message: `אין שיעור כרגע עבור ${student.class_name}`,
        schedule: scheduleInfo,
        current_time: bangkokTime.timeLabel,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminUserId = student.user_id;
    const today = bangkokTime.date;

    // Find or create today's session
    let { data: session } = await adminClient
      .from('sessions')
      .select('id')
      .eq('user_id', adminUserId)
      .eq('session_date', today)
      .eq('class_name', student.class_name)
      .limit(1)
      .single();

    if (!session) {
      // Use upsert to handle race conditions - unique constraint prevents duplicates
      const { data: newSession, error: sessionError } = await adminClient
        .from('sessions')
        .upsert({
          user_id: adminUserId,
          session_date: today,
          class_name: student.class_name,
          is_trial: false,
        }, { onConflict: 'user_id,session_date,class_name' })
        .select('id')
        .single();

      if (sessionError || !newSession) {
        // Try to fetch it if upsert failed (another request already created it)
        const { data: existingSession } = await adminClient
          .from('sessions')
          .select('id')
          .eq('user_id', adminUserId)
          .eq('session_date', today)
          .eq('class_name', student.class_name)
          .limit(1)
          .single();

        if (!existingSession) {
          return new Response(JSON.stringify({ error: 'session-error', message: 'שגיאה ביצירת שיעור' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        session = existingSession;
      } else {
        session = newSession;
      }
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

    // Insert attendance
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

    return new Response(JSON.stringify({
      status: 'success',
      message: `${student.name} ${student.last_name || ''} - נרשמת בהצלחה! ✅`,
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
