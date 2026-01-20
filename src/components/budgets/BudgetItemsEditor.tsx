import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Copy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateItemTotal, formatCurrency } from '@/lib/budget-utils';

interface BudgetItem {
  id?: string;
  service_id?: string;
  specialist_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string;
}

interface BudgetItemsEditorProps {
  items: BudgetItem[];
  onChange: (items: BudgetItem[]) => void;
  disabled?: boolean;
}

export const BudgetItemsEditor = ({ items, onChange, disabled }: BudgetItemsEditorProps) => {
  const [localItems, setLocalItems] = useState<BudgetItem[]>(items);
  const isInternalUpdate = useRef(false);

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, category')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: specialists } = useQuery({
    queryKey: ['specialists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name, type')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    // Solo sincronizar desde props si no fue un cambio interno
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    setLocalItems(items);
  }, [items]);

  const updateItems = (updatedItems: BudgetItem[]) => {
    isInternalUpdate.current = true;
    setLocalItems(updatedItems);
    onChange(updatedItems);
  };

  const handleAddItem = () => {
    const newItem: BudgetItem = {
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
    };
    updateItems([...localItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = localItems.filter((_, i) => i !== index);
    updateItems(updatedItems);
  };

  const handleDuplicateItem = (index: number) => {
    const itemToDuplicate = localItems[index];
    const duplicatedItem: BudgetItem = {
      ...itemToDuplicate,
      id: undefined,
    };
    const updatedItems = [
      ...localItems.slice(0, index + 1),
      duplicatedItem,
      ...localItems.slice(index + 1),
    ];
    updateItems(updatedItems);
  };

  const handleItemChange = (index: number, field: keyof BudgetItem, value: any) => {
    const updatedItems = [...localItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    // Recalcular total si cambia cantidad o precio
    if (field === 'quantity' || field === 'unit_price') {
      updatedItems[index].total = calculateItemTotal(
        updatedItems[index].quantity,
        updatedItems[index].unit_price
      );
    }

    updateItems(updatedItems);
  };

  const handleServiceSelect = (index: number, serviceId: string) => {
    const service = services?.find((s) => s.id === serviceId);
    if (service) {
      const updatedItems = [...localItems];
      updatedItems[index] = {
        ...updatedItems[index],
        service_id: serviceId,
        // Solo pre-rellenar descripción si está vacía
        description: updatedItems[index].description || service.name,
      };
      updateItems(updatedItems);
    }
  };

  const totalAmount = localItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Líneas del Presupuesto</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir Línea
        </Button>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-sm font-medium text-muted-foreground border-b">
        <div className="col-span-6">Servicio</div>
        <div className="col-span-1 text-center">Cant.</div>
        <div className="col-span-2 text-center">Precio Unit.</div>
        <div className="col-span-2 text-right">Total</div>
        <div className="col-span-1"></div>
      </div>

      <div className="space-y-3">
        {localItems.map((item, index) => (
          <div
            key={index}
            className="p-3 border rounded-lg bg-card space-y-2"
          >
            {/* Primera línea: Servicio + Cantidad + Precio + Total + Eliminar */}
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6">
                <Select
                  value={item.service_id || ''}
                  onValueChange={(value) => handleServiceSelect(index, value)}
                  disabled={disabled}
                >
                  <SelectTrigger className={!item.service_id ? 'border-destructive ring-1 ring-destructive/30' : ''}>
                    <SelectValue placeholder="Selecciona un servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {services?.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                        {service.category ? ` · ${service.category}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={item.quantity || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleItemChange(index, 'quantity', val === '' ? 0 : parseFloat(val) || 0);
                  }}
                  disabled={disabled}
                />
              </div>

              <div className="col-span-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={item.unit_price || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleItemChange(index, 'unit_price', val === '' ? 0 : parseFloat(val) || 0);
                  }}
                  disabled={disabled}
                />
              </div>

              <div className="col-span-2 flex items-center justify-end font-semibold">
                {formatCurrency(item.total)}
              </div>

              <div className="col-span-1 flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDuplicateItem(index)}
                  disabled={disabled}
                  title="Duplicar línea"
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(index)}
                  disabled={disabled}
                  title="Eliminar línea"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Segunda línea: Descripción (solo visible cuando hay servicio) */}
            {item.service_id && (
              <Input
                type="text"
                placeholder="Descripción del servicio..."
                value={item.description}
                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                disabled={disabled}
              />
            )}

            {/* Tercera línea: Especialista - dato interno (solo visible cuando hay servicio) */}
            {item.service_id && (
              <Select
                value={item.specialist_id || ''}
                onValueChange={(value) => handleItemChange(index, 'specialist_id', value)}
                disabled={disabled}
              >
                <SelectTrigger className="text-sm text-muted-foreground bg-muted/30 border-dashed">
                  <SelectValue placeholder="Especialista asignado (interno, opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {specialists?.map((specialist) => (
                    <SelectItem key={specialist.id} value={specialist.id}>
                      {specialist.name}
                      {specialist.type ? ` · ${specialist.type}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Cuarta línea: Notas internas (solo visible cuando hay servicio) */}
            {item.service_id && (
              <Input
                type="text"
                placeholder="Notas internas (no aparecen en el presupuesto final)..."
                value={item.notes || ''}
                onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                disabled={disabled}
                className="text-sm text-muted-foreground bg-muted/30 border-dashed"
              />
            )}
          </div>
        ))}
      </div>

      {localItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No hay líneas. Haz clic en "Añadir Línea" para comenzar.
        </div>
      )}

      <div className="flex justify-end items-center gap-4 pt-4 border-t">
        <span className="text-lg font-semibold">Total:</span>
        <span className="text-2xl font-bold">{formatCurrency(totalAmount)}</span>
      </div>
    </div>
  );
};
