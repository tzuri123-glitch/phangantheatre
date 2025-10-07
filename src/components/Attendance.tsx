import { Session, Student } from '@/types';
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
import { useState } from 'react';

interface AttendanceProps {
  sessions: Session[];
  students: Student[];
  onCreateSession: () => void;
}

export default function Attendance({ sessions, students, onCreateSession }: AttendanceProps) {
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  const getStudentName = (studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || '';
  };

  const filterStudentRecords = (sessionStudents: typeof sessions[0]['students']) => {
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
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-3xl font-bold text-foreground">נוכחות</h2>
        <div className="flex gap-4 items-center flex-1 max-w-md">
          <Input
            placeholder="חיפוש לפי שם תלמיד..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>
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
                  {filterStudentRecords(session.students).map((record) => (
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
