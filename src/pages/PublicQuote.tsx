import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FileDown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateBudgetPDF } from '@/utils/pdf/budgetPDFGenerator';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
};

interface GroupedCategory {
  categoryName: string;
  items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  subtotal: number;
}

const groupItemsByCategory = (items: any[]): GroupedCategory[] => {
  const grouped: Record<string, { items: any[]; subtotal: number }> = {};
  items.forEach((item) => {
    const cat = item.service?.category || item.service?.name || 'Otros servicios';
    if (!grouped[cat]) grouped[cat] = { items: [], subtotal: 0 };
    grouped[cat].items.push(item);
    grouped[cat].subtotal += item.total;
  });
  return Object.entries(grouped).map(([categoryName, data]) => ({
    categoryName,
    items: data.items,
    subtotal: data.subtotal,
  }));
};

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-quote', token],
    queryFn: async () => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-public-quote?token=${token}`,
        { headers: { apikey: SUPABASE_ANON_KEY } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al cargar el presupuesto');
      }
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#00467E]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-800">Enlace no válido</h2>
          <p className="text-gray-600">{(error as Error)?.message || 'Este enlace no es válido o ha expirado.'}</p>
        </div>
      </div>
    );
  }

  const { budget, items } = data;
  const client = budget.client;
  const groupedItems = groupItemsByCategory(items);
  const total = budget.total_amount || items.reduce((sum: number, i: any) => sum + i.total, 0);

  const handleDownloadPDF = () => {
    generateBudgetPDF({
      budget: { ...budget, client },
      items,
    });
  };

  const validUntilFormatted = budget.valid_until
    ? new Date(budget.valid_until).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#00467E] text-white p-8">
          <div className="flex items-start justify-between">
            <div>
              <img src="/images/hayas-logo-white.png" alt="Hayas Marketing" className="h-12 mb-4" />
              <p className="text-sm opacity-80">APPS 4 BUSINESS SL</p>
              <p className="text-sm opacity-80">C/Manzanares 4 - 28005 Madrid</p>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold mb-2">QUOTE</h1>
              <p className="text-lg">{budget.code}</p>
              <p className="text-sm opacity-80 mt-1">{client.name}</p>
            </div>
          </div>
        </div>

        {/* Quote info */}
        <div className="p-8 border-b">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-500 text-sm uppercase mb-2">Client</h3>
              <p className="font-semibold text-lg">{client.name}</p>
              {client.tax_id && <p className="text-gray-600">Tax ID: {client.tax_id}</p>}
              {client.address && <p className="text-gray-600">{client.address}</p>}
              {client.city && <p className="text-gray-600">{client.city}</p>}
            </div>
            <div className="text-right">
              {validUntilFormatted && (
                <div>
                  <h3 className="font-semibold text-gray-500 text-sm uppercase mb-2">Valid until</h3>
                  <p className="text-gray-800">{validUntilFormatted}</p>
                </div>
              )}
              {budget.client_po_number && budget.client_po_number !== 'Pendiente' && (
                <div className="mt-4">
                  <h3 className="font-semibold text-gray-500 text-sm uppercase mb-2">PO / Reference</h3>
                  <p className="text-gray-800">{budget.client_po_number}</p>
                </div>
              )}
            </div>
          </div>

          {/* Title and description */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-800">{budget.title}</h2>
            {budget.description && (
              <p className="text-gray-600 mt-2">{budget.description}</p>
            )}
          </div>
        </div>

        {/* Items table grouped by category */}
        <div className="p-8">
          {groupedItems.map((group) => (
            <div key={group.categoryName} className="mb-6">
              <div className="flex justify-between items-center bg-gray-100 px-4 py-2 rounded-t font-semibold text-sm">
                <span>{group.categoryName}</span>
                <span>{formatCurrency(group.subtotal)}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase">
                    <th className="text-left py-2 px-4">Description</th>
                    <th className="text-center py-2 px-4 w-20">Qty</th>
                    <th className="text-right py-2 px-4 w-28">Unit Price</th>
                    <th className="text-right py-2 px-4 w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm">{item.description}</td>
                      <td className="py-3 px-4 text-sm text-center">{item.quantity}</td>
                      <td className="py-3 px-4 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Total */}
          <div className="flex justify-end mt-4 pt-4 border-t-2 border-[#00467E]">
            <div className="text-right">
              <span className="text-gray-500 text-sm uppercase mr-8">Total</span>
              <span className="text-2xl font-bold text-[#00467E]">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-8 bg-gray-50 border-t flex justify-center">
          <Button onClick={handleDownloadPDF} className="bg-[#00467E] hover:bg-[#003562]">
            <FileDown className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        {/* Footer */}
        <div className="p-4 text-center text-xs text-gray-400">
          This quote is valid until the date indicated • HAYAS MARKETING
        </div>
      </div>
    </div>
  );
}
