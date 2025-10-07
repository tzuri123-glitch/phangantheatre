import { useEffect, useRef } from 'react';
import { Student, Payment } from '@/types';
import { Card } from '@/components/ui/card';
import Chart from 'chart.js/auto';
import { formatILS } from '@/lib/utils';

interface DashboardProps {
  students: Student[];
  payments: Payment[];
}

export default function Dashboard({ students, payments }: DashboardProps) {
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const pieChartInstance = useRef<Chart | null>(null);

  const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);

  const incomeByMonth = payments.reduce((acc, p) => {
    const monthKey = p.date.slice(0, 7);
    acc[monthKey] = (acc[monthKey] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  const incomeByType = payments.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    if (!barChartRef.current || !pieChartRef.current) return;

    // Destroy previous charts
    if (barChartInstance.current) {
      barChartInstance.current.destroy();
    }
    if (pieChartInstance.current) {
      pieChartInstance.current.destroy();
    }

    // Bar chart - monthly income
    const barLabels = Object.keys(incomeByMonth).sort();
    const barData = barLabels.map((k) => incomeByMonth[k]);

    barChartInstance.current = new Chart(barChartRef.current, {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [
          {
            label: 'הכנסות חודשיות',
            data: barData,
            backgroundColor: 'hsl(188 91% 36%)',
            borderRadius: 8,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    // Pie chart - income by type
    const pieLabels = Object.keys(incomeByType);
    const pieData = pieLabels.map((k) => incomeByType[k]);
    const colors = [
      'hsl(188 91% 36%)',
      'hsl(188 91% 50%)',
      'hsl(142 71% 45%)',
      'hsl(48 96% 53%)',
      'hsl(0 84% 60%)',
    ];

    pieChartInstance.current = new Chart(pieChartRef.current, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [
          {
            data: pieData,
            backgroundColor: colors.slice(0, pieLabels.length),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    return () => {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
    };
  }, [payments]);

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-3xl font-bold text-foreground">ברוך הבא למערכת ניהול החוג! 🎭</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">סה"כ תלמידים</h3>
          <p className="text-4xl font-bold text-primary">{students.length}</p>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-accent to-accent/50 border-primary/20">
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">סה"כ הכנסות</h3>
          <p className="text-4xl font-bold text-primary">{formatILS(totalIncome)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-foreground">הכנסות חודשיות</h3>
          <canvas ref={barChartRef}></canvas>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-foreground">הכנסות לפי סוג</h3>
          <canvas ref={pieChartRef}></canvas>
        </Card>
      </div>
    </div>
  );
}
