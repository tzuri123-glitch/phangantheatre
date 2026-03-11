import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PendingAttendanceRequest {
  id: string;
  student_id: string;
  requesting_user_id: string;
  class_name: string;
  requested_date: string;
  note: string | null;
  status: string;
  created_at: string;
}

interface PendingAttendanceProps {
  onAttendanceApproved: () => void;
}

export default function PendingAttendance({ onAttendanceApproved }: PendingAttendanceProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PendingAttendanceRequest[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadRequests();

    const channel = supabase
      .channel('pending-attendance-admin')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pending_attendance',
      }, () => { loadRequests(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadRequests = async () => {
    const { data } = await supabase
      .from('pending_attendance' as any)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setRequests(data as any);
      const studentIds = [...new Set((data as any[]).map((r: any) => r.student_id))];
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name, last_name')
        .in('id', studentIds);
      if (studentsData) {
        const map: Record<string, string> = {};
        studentsData.forEach(s => { map[s.id] = `${s.name} ${s.last_name || ''}`; });
        setStudentNames(map);
      }
    } else {
      setRequests([]);
    }
  };

  const handleApprove = async (request: PendingAttendanceRequest) => {
    if (!user) return;
    setProcessing(request.id);
    try {
      // Find or create session for that date and class
      let sessionId: string;
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', request.requested_date)
        .eq('class_name', request.class_name)
        .limit(1)
        .single();

      if (existingSession) {
        sessionId = existingSession.id;
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            session_date: request.requested_date,
            class_name: request.class_name,
          })
          .select()
          .single();
        if (sessionError || !newSession) throw new Error('שגיאה ביצירת שיעור');
        sessionId = newSession.id;
      }

      // Check if already has attendance
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('session_id', sessionId)
        .eq('student_id', request.student_id)
        .limit(1)
        .single();

      if (!existing) {
        const { error: attError } = await supabase
          .from('attendance')
          .insert({
            user_id: user.id,
            session_id: sessionId,
            student_id: request.student_id,
            status: 'נוכח',
          });
        if (attError) throw new Error('שגיאה ברישום נוכחות');
      }

      // Mark request as approved
      await supabase
        .from('pending_attendance' as any)
        .update({ status: 'approved', resolved_at: new Date().toISOString() })
        .eq('id', request.id);

      toast.success(`נוכחות אושרה ל-${studentNames[request.student_id] || 'תלמיד'} ✅`);
      setRequests(prev => prev.filter(r => r.id !== request.id));
      onAttendanceApproved();
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: PendingAttendanceRequest) => {
    setProcessing(request.id);
    try {
      await supabase
        .from('pending_attendance' as any)
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', request.id);

      toast.success('הבקשה נדחתה');
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <Card className="p-4 mb-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
      <h3 className="font-bold text-sm text-orange-800 dark:text-orange-200 mb-3">
        📋 בקשות נוכחות ממתינות ({requests.length})
      </h3>
      <div className="space-y-3">
        {requests.map((req) => (
          <div key={req.id} className="bg-background rounded-lg p-3 border flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-foreground">{studentNames[req.student_id] || '...'}</p>
              <p className="text-xs text-muted-foreground">
                {req.class_name} • {new Date(req.requested_date).toLocaleDateString('he-IL')}
                {req.note && ` • "${req.note}"`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(req)}
                disabled={processing === req.id}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {processing === req.id ? '...' : '✅ אשר'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleReject(req)}
                disabled={processing === req.id}
              >
                ❌ דחה
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
