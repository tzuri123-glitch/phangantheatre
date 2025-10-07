import { Student, CLASS_OPTIONS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { useState } from 'react';

interface StudentsProps {
  students: Student[];
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
}

export default function Students({ students, onAddStudent, onEditStudent }: StudentsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter((student) => {
    if (searchQuery.length < 3) return true;
    const query = searchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.lastName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-3xl font-bold text-foreground">תלמידים</h2>
        <div className="flex gap-4 items-center flex-1 max-w-md">
          <Input
            placeholder="חיפוש לפי שם או שם משפחה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>
        <Button onClick={onAddStudent} className="bg-primary hover:bg-primary-hover">
          ➕ הוסף תלמיד
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם פרטי</TableHead>
              <TableHead className="text-right">שם משפחה</TableHead>
              <TableHead className="text-right">טלפון</TableHead>
              <TableHead className="text-right">חוג</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell className="font-medium">{student.lastName}</TableCell>
                <TableCell>{student.phone}</TableCell>
                <TableCell>{student.className}</TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm ${
                      student.status === 'פעיל'
                        ? 'bg-green-100 text-green-800'
                        : student.status === 'חדש'
                        ? 'bg-blue-100 text-blue-800'
                        : student.status === 'בהקפאה'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {student.status}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditStudent(student)}
                  >
                    ערוך
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
