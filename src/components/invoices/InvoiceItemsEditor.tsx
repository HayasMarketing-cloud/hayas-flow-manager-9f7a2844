import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Edit2, Trash2, Plus, Save, X } from 'lucide-react';
import { useState } from 'react';

export interface InvoiceItem {
  id?: string;
  type: 'manual' | 'aggregated';
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  request_ids?: string[];
}

interface InvoiceItemsEditorProps {
  items: InvoiceItem[];
  onChange: (items: InvoiceItem[]) => void;
  disabled?: boolean;
}

export function InvoiceItemsEditor({
  items,
  onChange,
  disabled = false,
}: InvoiceItemsEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [newManualItem, setNewManualItem] = useState<Partial<InvoiceItem>>({
    type: 'manual',
    description: '',
    quantity: 1,
    unit_price: 0,
  });

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditingItem({ ...items[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingItem) {
      const updatedItems = [...items];
      updatedItems[editingIndex] = {
        ...editingItem,
        total: editingItem.quantity * editingItem.unit_price,
      };
      onChange(updatedItems);
      setEditingIndex(null);
      setEditingItem(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingItem(null);
  };

  const handleDelete = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    onChange(updatedItems);
  };

  const handleAddManual = () => {
    if (newManualItem.description && newManualItem.quantity && newManualItem.unit_price) {
      const item: InvoiceItem = {
        type: 'manual',
        description: newManualItem.description,
        quantity: newManualItem.quantity,
        unit_price: newManualItem.unit_price,
        total: newManualItem.quantity * newManualItem.unit_price,
      };
      onChange([...items, item]);
      setNewManualItem({
        type: 'manual',
        description: '',
        quantity: 1,
        unit_price: 0,
      });
      setIsAddingManual(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map((item, index) => (
          <Card key={index} className="p-4">
            {editingIndex === index && editingItem ? (
              <div className="space-y-3">
                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={editingItem.description}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, description: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={editingItem.quantity || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingItem({
                          ...editingItem,
                          quantity: val === '' ? 0 : parseFloat(val) || 0,
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label>Precio unitario</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={editingItem.unit_price || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingItem({
                          ...editingItem,
                          unit_price: val === '' ? 0 : parseFloat(val) || 0,
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label>Total</Label>
                    <Input
                      value={formatCurrency(
                        editingItem.quantity * editingItem.unit_price
                      )}
                      disabled
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{item.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Cantidad: {item.quantity.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    <span>Precio: {formatCurrency(item.unit_price)}</span>
                    <span className="font-medium text-foreground">
                      Total: {formatCurrency(item.total)}
                    </span>
                  </div>
                  {item.type === 'aggregated' && item.request_ids && (
                    <p className="text-xs text-muted-foreground">
                      {item.request_ids.length} requests agregadas
                    </p>
                  )}
                </div>
                {!disabled && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(index)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {!disabled && (
        <div>
          {isAddingManual ? (
            <Card className="p-4 space-y-3">
              <h4 className="font-medium">Nueva línea manual</h4>
              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={newManualItem.description}
                  onChange={(e) =>
                    setNewManualItem({ ...newManualItem, description: e.target.value })
                  }
                  placeholder="Ej: Mantenimiento mensual HubSpot"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={newManualItem.quantity || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewManualItem({
                        ...newManualItem,
                        quantity: val === '' ? 0 : parseFloat(val) || 0,
                      });
                    }}
                  />
                </div>
                <div>
                  <Label>Precio unitario</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={newManualItem.unit_price || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewManualItem({
                        ...newManualItem,
                        unit_price: val === '' ? 0 : parseFloat(val) || 0,
                      });
                    }}
                  />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input
                    value={formatCurrency(
                      (newManualItem.quantity || 0) * (newManualItem.unit_price || 0)
                    )}
                    disabled
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddingManual(false);
                    setNewManualItem({
                      type: 'manual',
                      description: '',
                      quantity: 1,
                      unit_price: 0,
                    });
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAddManual}>
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="outline" onClick={() => setIsAddingManual(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir línea manual
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
