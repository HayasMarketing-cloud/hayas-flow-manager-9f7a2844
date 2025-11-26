import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateServiceTotal, formatCurrency, getBillingModeLabel } from '@/lib/contract-utils';

interface ContractService {
  id?: string;
  service_id?: string;
  specialist_id?: string;
  description: string;
  quantity: number;
  price_value?: number;
  unit_price?: number; // Legacy support
  billing_frequency?: string;
  billing_mode?: string; // Legacy support
  notes?: string;
}

interface ContractServicesEditorProps {
  services: ContractService[];
  onChange: (services: ContractService[]) => void;
  disabled?: boolean;
}

export const ContractServicesEditor = ({ services, onChange, disabled }: ContractServicesEditorProps) => {
  const [localServices, setLocalServices] = useState<ContractService[]>(services);

  const { data: availableServices } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
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
        .select('id, name')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setLocalServices(services);
  }, [services]);

  const handleAddService = () => {
    const newService: ContractService = {
      description: '',
      quantity: 1,
      price_value: 0,
      billing_frequency: 'monthly',
    };
    const updatedServices = [...localServices, newService];
    setLocalServices(updatedServices);
    onChange(updatedServices);
  };

  const handleRemoveService = (index: number) => {
    const updatedServices = localServices.filter((_, i) => i !== index);
    setLocalServices(updatedServices);
    onChange(updatedServices);
  };

  const handleServiceChange = (index: number, field: keyof ContractService, value: any) => {
    const updatedServices = [...localServices];
    updatedServices[index] = {
      ...updatedServices[index],
      [field]: value,
    };
    setLocalServices(updatedServices);
    onChange(updatedServices);
  };

  const handleServiceSelect = (index: number, serviceId: string) => {
    const service = availableServices?.find((s) => s.id === serviceId);
    if (service) {
      handleServiceChange(index, 'service_id', serviceId);
      handleServiceChange(index, 'description', service.name);
      // price_value debe ser ingresado manualmente por el usuario
    }
  };

  const totalAmount = localServices.reduce(
    (sum, service) => sum + calculateServiceTotal(service.quantity, service.price_value || service.unit_price || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Servicios del Contrato</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddService}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir Servicio
        </Button>
      </div>

      <div className="space-y-3">
        {localServices.map((service, index) => (
          <div
            key={index}
            className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-card"
          >
            <div className="col-span-3">
              <Select
                value={service.service_id || ''}
                onValueChange={(value) => handleServiceSelect(index, value)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Servicio" />
                </SelectTrigger>
                <SelectContent>
                  {availableServices?.map((srv) => (
                    <SelectItem key={srv.id} value={srv.id}>
                      {srv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Select
                value={service.specialist_id || ''}
                onValueChange={(value) => handleServiceChange(index, 'specialist_id', value)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Especialista" />
                </SelectTrigger>
                <SelectContent>
                  {specialists?.map((specialist) => (
                    <SelectItem key={specialist.id} value={specialist.id}>
                      {specialist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1">
              <Input
                type="number"
                min="1"
                placeholder="Cant."
                value={service.quantity}
                onChange={(e) =>
                  handleServiceChange(index, 'quantity', parseInt(e.target.value) || 1)
                }
                disabled={disabled}
              />
            </div>

            <div className="col-span-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Precio"
                value={service.price_value || service.unit_price || 0}
                onChange={(e) =>
                  handleServiceChange(index, 'price_value', parseFloat(e.target.value) || 0)
                }
                disabled={disabled}
              />
            </div>

            <div className="col-span-2">
              <Select
                value={service.billing_frequency || service.billing_mode || 'monthly'}
                onValueChange={(value) => handleServiceChange(index, 'billing_frequency', value)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="one_time">Único</SelectItem>
                  <SelectItem value="per_project">Por Proyecto</SelectItem>
                  <SelectItem value="on_demand">Por Demanda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 flex items-center justify-end font-semibold">
              {formatCurrency(calculateServiceTotal(service.quantity, service.price_value || service.unit_price || 0))}
            </div>

            <div className="col-span-1 flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveService(index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {localServices.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No hay servicios. Haz clic en "Añadir Servicio" para comenzar.
        </div>
      )}

      <div className="flex justify-end items-center gap-4 pt-4 border-t">
        <span className="text-lg font-semibold">Total:</span>
        <span className="text-2xl font-bold">{formatCurrency(totalAmount)}</span>
      </div>
    </div>
  );
};
