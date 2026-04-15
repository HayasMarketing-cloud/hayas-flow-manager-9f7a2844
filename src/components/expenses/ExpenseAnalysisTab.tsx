import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExpenses } from '@/hooks/useExpenses';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6B7280'];

const formatCurrency = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

export function ExpenseAnalysisTab() {
  const { data: expenses = [] } = useExpenses();

  const activeExpenses = expenses.filter(e => e.is_active);
  const inactiveWithCost = expenses.filter(e => !e.is_active && e.monthly_cost > 0);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.monthly_cost; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [activeExpenses]);

  const periodicityData = useMemo(() => {
    const monthly = activeExpenses.filter(e => e.periodicity === 'monthly').reduce((s, e) => s + e.monthly_cost, 0);
    const annual = activeExpenses.filter(e => e.periodicity === 'annual').reduce((s, e) => s + e.monthly_cost, 0);
    const quarterly = activeExpenses.filter(e => e.periodicity === 'quarterly').reduce((s, e) => s + e.monthly_cost, 0);
    return [
      { name: 'Mensual', mensual: monthly, anual: monthly * 12 },
      { name: 'Anual', mensual: annual, anual: annual * 12 },
      { name: 'Trimestral', mensual: quarterly, anual: quarterly * 12 },
    ];
  }, [activeExpenses]);

  const totalMonthly = activeExpenses.reduce((s, e) => s + e.monthly_cost, 0);
  const totalAnnual = totalMonthly * 12;

  // Top expenses
  const topExpenses = [...activeExpenses].sort((a, b) => b.monthly_cost - a.monthly_cost).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Mensual</p>
            <p className="text-2xl font-bold">{formatCurrency(totalMonthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Anual</p>
            <p className="text-2xl font-bold">{formatCurrency(totalAnnual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Suscripciones Activas</p>
            <p className="text-2xl font-bold">{activeExpenses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Inactivas con coste</p>
            <p className="text-2xl font-bold text-amber-600">{inactiveWithCost.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribución por Categoría</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 Gastos (mensual)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topExpenses} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tickFormatter={(v) => `${v}€`} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="monthly_cost" fill="#3B82F6" name="Coste/mes" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {inactiveWithCost.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader><CardTitle className="text-base text-amber-600">⚠️ Gastos Inactivos con Coste Registrado</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {inactiveWithCost.map(e => (
                <li key={e.id} className="flex justify-between">
                  <span>{e.name}</span>
                  <span className="font-mono">{formatCurrency(e.monthly_cost)}/mes</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
