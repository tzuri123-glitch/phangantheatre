import { Session, Student, Payment } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { getPaymentStatusForDate } from '@/lib/paymentStatus';

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
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [sessionSearchQueries, setSessionSearchQueries] = useState<Record<string, string>>({});

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
        <Button onClick={onCreateSession} className="bg-primary hover:bg-primary-hover">
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
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterStudentRecords(session.id, session.students).map((record) => {
                      const paymentStatus = getPaymentStatusForDate(record.studentId, session.date, students, payments, sessions);
                      
                      // קביעת צבע רקע לפי סטטוס
                      let rowClassName = '';
                      if (paymentStatus.balance < 0) {
                        rowClassName = 'bg-red-100 hover:bg-red-200'; // חוב - אדום
                      } else if (paymentStatus.balance === 0) {
                        rowClassName = 'bg-green-100 hover:bg-green-200'; // מאוזן - ירוק
                      } else if (paymentStatus.balance > 0) {
                        rowClassName = 'bg-yellow-100 hover:bg-yellow-200'; // יתרה - צהוב
                      }
                      
                      return (
                        <TableRow key={record.studentId} className={rowClassName}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getStudentName(record.studentId)}
                              {paymentStatus.balance >= 0 ? (
                                <Badge className="bg-green-500 text-white text-xs">
                                  {paymentStatus.message}
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">{paymentStatus.message}</Badge>
                              )}
                            </div>
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
                                {paymentStatus.hasMonthlySubscription && (
                                  <SelectItem value="לא באי">לא באי (הקפאה)</SelectItem>
                                )}
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