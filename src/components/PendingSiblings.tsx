import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface PendingSibling {
  id: string;
  requesting_user_id: string;
  existing_student_id: string;
  sibling_name: string;
  sibling_birth_date: string | null;
  sibling_phone: string | null;
  sibling_class: string;
  status: string;
  created_at: string;
}

interface PendingSiblingsProps {
  onSiblingApproved: () => void;
}

export default function PendingSiblings({ onSiblingApproved }: PendingSiblingsProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PendingSibling[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadRequests();

    const channel = supabase
      .channel('pending-siblings-admin')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pending_siblings',
      }, () => { loadRequests(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadRequests = async () => {
    const { data } = await supabase
      .from('pending_siblings' as any)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setRequests(data as any);
      // Load existing student names
      const studentIds = [...new Set((data as any[]).map((r: any) => r.existing_student_id))];
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

  const handleApprove = async (request: PendingSibling) => {
    setProcessing(request.id);
    try {
      // Get existing student info for parent details
      const { data: existingStudent } = await supabase
        .from('students')
        .select('*')
        .eq('id', request.existing_student_id)
        .single();

      if (!existingStudent) throw new Error('Student not found');

      const parentNameParts = (existingStudent.parent_name || '').split(' ');
      const parentFirst = parentNameParts[0] || '';
      const parentLast = existingStudent.last_name || parentNameParts.slice(1).join(' ') || '';

      // Register the sibling via the edge function
      const { data: result, error: fnError } = await supabase.functions.invoke('register-student', {
        body: {
          studentName: request.sibling_name,
          parentName: parentFirst,
          parentLastName: parentLast,
          parentPhone: existingStudent.parent_phone || '',
          studentPhone: request.sibling_phone || null,
          birthDate: request.sibling_birth_date || null,
          siblingId: request.existing_student_id,
          className: request.sibling_class,
          overrideAuthUserId: request.requesting_user_id,
        },
      });
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);

      // Mark request as approved
      await supabase
        .from('pending_siblings' as any)
        .update({ status: 'approved', resolved_at: new Date().toISOString() })
        .eq('id', request.id);

      toast.success(`אח/אחות "${request.sibling_name}" אושר/ה בהצלחה! ✅`);
      setRequests(prev => prev.filter(r => r.id !== request.id));
      onSiblingApproved();
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: PendingSibling) => {
    setProcessing(request.id);
    try {
      await supabase
        .from('pending_siblings' as any)
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
    <Card className="p-4 mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <h3 className="font-bold text-sm text-blue-800 dark:text-blue-200 mb-3">
        👨‍👩‍👧‍👦 בקשות הוספת אח/אחות ({requests.length})
      </h3>
      <div className="space-y-3">
        {requests.map((req) => (
          <div key={req.id} className="bg-background rounded-lg p-3 border flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-foreground">{req.sibling_name}</p>
              <p className="text-xs text-muted-foreground">
                אח/אחות של: {studentNames[req.existing_student_id] || '...'}
                {' • '}{req.sibling_class}
                {req.sibling_birth_date && ` • ${new Date(req.sibling_birth_date).toLocaleDateString('he-IL')}`}
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
