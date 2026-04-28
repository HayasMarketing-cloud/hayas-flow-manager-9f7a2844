import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type QuarterStatus = 'closed' | 'pending_payment' | 'in_progress' | 'forecast';

export interface IrpfSpecialistRow {
  specialistId: string;
  name: string;
  monthly: number[]; // length 12
  quarterly: number[]; // length 4
  yearTotal: number;
}

export interface IrpfQuarterSummary {
  quarter: number; // 1-4
  months: number[]; // [1,2,3] etc.
  paymentDueDate: Date; // ~20 of month after quarter close
  total: number;
  totalPaid: number; // from liquidations status=paid
  totalForecast: number; // from non-paid liquidations
  status: QuarterStatus;
}

export interface IrpfQuarterlyData {
  rows: IrpfSpecialistRow[];
  monthlyTotals: number[]; // length 12
  quarterlyTotals: number[]; // length 4
  yearTotal: number;
  quarters: IrpfQuarterSummary[];
  totalPaid: number;
  totalForecast: number;
}

const QUARTER_PAYMENT_MONTH = [3, 6, 9, 11]; // index 0..3 → month 0-indexed of payment (April=3, July=6, Oct=9, Jan next year=0 but we handle below)

function getQuarterStatus(quarter: number, year: number): QuarterStatus {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  // Quarter month range (0-indexed)
  const quarterEndMonth = quarter * 3 - 1; // 1T->2 (mar), 2T->5 (jun), 3T->8 (sep), 4T->11 (dec)
  const paymentMonth = quarter === 4 ? 0 : quarterEndMonth + 1; // 4T pays in January
  const paymentYear = quarter === 4 ? year + 1 : year;
  const paymentDueDay = 20;

  // future quarter
  if (year > currentYear || (year === currentYear && quarter * 3 - 1 > currentMonth)) {
    return 'forecast';
  }
  // current in-progress quarter
  if (year === currentYear && currentMonth >= (quarter - 1) * 3 && currentMonth <= quarterEndMonth) {
    return 'in_progress';
  }
  // closed quarter — past payment date?
  const paymentDate = new Date(paymentYear, paymentMonth, paymentDueDay);
  if (today >= paymentDate) {
    return 'closed';
  }
  return 'pending_payment';
}

function getPaymentDueDate(quarter: number, year: number): Date {
  const quarterEndMonth = quarter * 3 - 1;
  const paymentMonth = quarter === 4 ? 0 : quarterEndMonth + 1;
  const paymentYear = quarter === 4 ? year + 1 : year;
  return new Date(paymentYear, paymentMonth, 20);
}

export function useIrpfQuarterly(year: number) {
  return useQuery({
    queryKey: ['irpf-quarterly', year],
    queryFn: async (): Promise<IrpfQuarterlyData> => {
      // Pull liquidation_invoices for the year, joined to liquidations + specialists.
      // Devengo date = liquidations.paid_at if exists else liquidations.updated_at when status='paid'
      // For non-paid liquidations, use liquidation period (period_year/period_month) to project forecast
      // into the corresponding quarter — that way we can show expected IRPF for in-progress quarters.
      const { data, error } = await supabase
        .from('liquidation_invoices')
        .select(`
          id,
          irpf_amount,
          liquidation:liquidations!inner (
            id,
            status,
            paid_at,
            updated_at,
            period_year,
            period_month,
            specialist:specialists!inner ( id, name )
          )
        `)
        .not('irpf_amount', 'is', null)
        .gt('irpf_amount', 0);

      if (error) throw error;

      const specialistsMap = new Map<string, IrpfSpecialistRow>();
      const monthlyTotals = new Array(12).fill(0);
      const quarterlyTotals = new Array(4).fill(0);
      const quarterPaid = new Array(4).fill(0);
      const quarterForecast = new Array(4).fill(0);

      (data ?? []).forEach((row: any) => {
        const liq = row.liquidation;
        if (!liq) return;
        const specialist = liq.specialist;
        if (!specialist) return;

        // Determine accrual date
        let accrualDate: Date | null = null;
        const isPaid = liq.status === 'paid';
        if (isPaid) {
          const dateStr = liq.paid_at || liq.updated_at;
          if (dateStr) accrualDate = new Date(dateStr);
        } else {
          // Forecast: use period
          if (liq.period_year && liq.period_month) {
            // IRPF accrues when paid → project payment ~28 of month after period
            const projMonth = liq.period_month; // 0-indexed equivalent: period_month - 1 + 1 = period_month
            accrualDate = new Date(liq.period_year, projMonth, 1);
          }
        }

        if (!accrualDate || accrualDate.getFullYear() !== year) return;

        const monthIdx = accrualDate.getMonth();
        const quarterIdx = Math.floor(monthIdx / 3);
        const irpf = Number(row.irpf_amount) || 0;

        let specRow = specialistsMap.get(specialist.id);
        if (!specRow) {
          specRow = {
            specialistId: specialist.id,
            name: specialist.name,
            monthly: new Array(12).fill(0),
            quarterly: new Array(4).fill(0),
            yearTotal: 0,
          };
          specialistsMap.set(specialist.id, specRow);
        }
        specRow.monthly[monthIdx] += irpf;
        specRow.quarterly[quarterIdx] += irpf;
        specRow.yearTotal += irpf;

        monthlyTotals[monthIdx] += irpf;
        quarterlyTotals[quarterIdx] += irpf;
        if (isPaid) quarterPaid[quarterIdx] += irpf;
        else quarterForecast[quarterIdx] += irpf;
      });

      const rows = Array.from(specialistsMap.values()).sort((a, b) => b.yearTotal - a.yearTotal);

      const quarters: IrpfQuarterSummary[] = [1, 2, 3, 4].map((q) => ({
        quarter: q,
        months: [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3],
        paymentDueDate: getPaymentDueDate(q, year),
        total: quarterlyTotals[q - 1],
        totalPaid: quarterPaid[q - 1],
        totalForecast: quarterForecast[q - 1],
        status: getQuarterStatus(q, year),
      }));

      return {
        rows,
        monthlyTotals,
        quarterlyTotals,
        yearTotal: monthlyTotals.reduce((s, v) => s + v, 0),
        quarters,
        totalPaid: quarterPaid.reduce((s, v) => s + v, 0),
        totalForecast: quarterForecast.reduce((s, v) => s + v, 0),
      };
    },
  });
}
