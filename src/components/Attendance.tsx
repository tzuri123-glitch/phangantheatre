import { Session, Student } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useState } from 'react';

interface AttendanceProps {
  sessions: Session[];
  students: Student[];
  onCreateSession: () => void;
}

export default function Attendance({ sessions, students, onCreateSession }: AttendanceProps) {
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  const getStudentName = (studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || '';
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
              <span className="text-2xl">{expandedSessions[session.id] ? '▴' : '▾'}</span>
            </div>

            {expandedSessions[session.id] && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תלמיד</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.students.map((record) => (
                    <TableRow key={record.studentId}>
                      <TableCell className="font-medium">
                        {getStudentName(record.studentId)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm ${
                            record.status === 'נוכח'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'לא הגיע'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {record.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
