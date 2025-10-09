import { Session, Student, Payment } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getPaymentStatusForSession, getStatusColor, getStatusBadge } from '@/lib/paymentStatus';

interface AttendanceProps {
  sessions: Session[];
  students: Student[];
  payments: Payment[];
  onCreateSession: () => void;
  onEditSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => void;
  onUpdateAttendance: (sessionId: string, studentId: string, status: 'נוכח' | 'לא הגיע' | 'לא באי' | 'עזב') => void;
  onRemoveStudentFromSession: (sessionId: string, studentId: string) => void;
}

export default function Attendance({ sessions, students, payments, onCreateSession, onEditSession, onDeleteSession, onUpdateAttendance, onRemoveStudentFromSession }: AttendanceProps) {
  const { user } = useAuth();
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [sessionSearchQueries, setSessionSearchQueries] = useState<Record<string, string>>({});
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  // Load subscriptions
  useEffect(() => {
    if (!user) return;
    
    const loadSubscriptions = async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id);
      
      if (data) {
        setSubscriptions(data.map(s => ({
          id: s.id,
          studentId: s.student_id,
          monthYear: s.month_year,
          totalEntries: s.total_entries,
          entriesRemaining: s.entries_remaining
        })));
      }
    };
    
    loadSubscriptions();
  }, [user]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  const getStudentName = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    return student ? `${student.name} ${student.lastName}` : '';
  };

  const filterStudentRecords = (sessionId: string, sessionStudents: typeof sessions[0]['students']) => {
    const searchQuery = sessionSearchQueries[sessionId] || '';
    if (searchQuery.length < 3) return sessionStudents;
    const query = searchQuery.toLowerCase();
    return sessionStudents.filter((record) => {
      const student = students.find((s) => s.id === record.studentId);
      if (!student) return false;
      return (
        student.name.toLowerCase().includes(query) ||
        student.lastName.toLowerCase().includes(query)
      );
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">נוכחות</h2>
        <Button onClick={onCreateSession} className="bg-magenta hover:bg-magenta-hover text-magenta-foreground">
          ➕ יצירת שיעור
        </Button>
      </div>

      <div className="space-y-4">
        {sessions.map((session) => (
          <Card key={session.id} className="overflow-hidden">
            <div
              className="p-4 bg-accent cursor-pointer hover:bg-accent/80 transition-colors flex justify-between items-center"
              onClick={() => toggleSession(session.id)}
            >
              <span className="font-semibold text-foreground">
                {session.date} – {session.className}
                {session.trial && ' (שיעור ניסיון)'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSession(session);
                  }}
                >
                  ✏️
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  🗑️
                </Button>
                <span className="text-2xl">{expandedSessions[session.id] ? '▴' : '▾'}</span>
              </div>
            </div>

            {expandedSessions[session.id] && (
              <div className="p-4">
                <div className="mb-4">
                  <Input
                    placeholder="חיפוש תלמיד..."
                    value={sessionSearchQueries[session.id] || ''}
                    onChange={(e) => setSessionSearchQueries(prev => ({ ...prev, [session.id]: e.target.value }))}
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תלמיד</TableHead>
                      <TableHead className="text-right">סטטוס תשלום</TableHead>
                      <TableHead className="text-right">סטטוס נוכחות</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterStudentRecords(session.id, session.students).map((record) => {
                      const student = students.find(s => s.id === record.studentId);
                      if (!student) return null;
                      
                      const paymentStatus = getPaymentStatusForSession(
                        student,
                        session,
                        payments,
                        subscriptions
                      );
                      const statusColor = getStatusColor(paymentStatus);
                      const statusBadge = getStatusBadge(paymentStatus);
                      
                      return (
                        <TableRow key={record.studentId} className={statusColor}>
                          <TableCell className="font-medium">
                            {getStudentName(record.studentId)}
                          </TableCell>
                          <TableCell>
                            {statusBadge && <Badge variant="outline">{statusBadge}</Badge>}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={record.status || undefined}
                              onValueChange={(v) => {
                                if (v && v !== '') {
                                  onUpdateAttendance(session.id, record.studentId, v as 'נוכח' | 'לא הגיע' | 'לא באי' | 'עזב');
                                }
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="בחר" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="נוכח">נוכח</SelectItem>
                                <SelectItem value="לא הגיע">לא הגיע</SelectItem>
                                <SelectItem value="לא באי">לא באי (הקפאה)</SelectItem>
                                <SelectItem value="עזב">עזב</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onRemoveStudentFromSession(session.id, record.studentId)}
                            >
                              🗑️
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}