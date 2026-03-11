import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get calling user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { studentName, parentName, parentLastName, parentPhone, studentPhone, birthDate, siblingId, className, overrideAuthUserId } = await req.json();

    // If overrideAuthUserId is provided, caller must be admin
    let authUserId = user.id;
    if (overrideAuthUserId) {
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
      if (!adminRole) {
        return new Response(JSON.stringify({ error: 'Admin access required for overrideAuthUserId' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authUserId = overrideAuthUserId;
    }

    if (!studentName || !parentName || !parentLastName || !parentPhone || !birthDate) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Allow multiple students per auth_user_id (siblings)

    // Find an admin user to set as user_id (owner)
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'No admin found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create student record
    const { data: student, error: insertError } = await supabase
      .from('students')
      .insert({
        name: studentName,
        last_name: parentLastName,
        parent_name: parentName + ' ' + parentLastName,
        parent_phone: parentPhone,
        phone: studentPhone || null,
        birth_date: birthDate || null,
        auth_user_id: user.id,
        user_id: adminRole.user_id,
        class_name: className || 'לא שובץ',
        status: 'פעיל',
        is_sibling: !!siblingId,
        sibling_id: siblingId || null,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Failed to create student', details: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, student }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
