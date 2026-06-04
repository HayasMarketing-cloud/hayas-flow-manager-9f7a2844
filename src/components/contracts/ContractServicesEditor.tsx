import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateServiceTotal, formatCurrency } from '@/lib/contract-utils';

interface ContractService {
  id?: string;
  service_id?: string;
  specialist_id?: string;
  description: string;
  quantity: number;
  price_value?: number;
  unit_price?: number; // Legacy support
  price_rule_type?: 'hourly' | 'fixed';
  billing_frequency?: string;
  billing_mode?: string; // Legacy support
  notes?: string;
  valid_from?: string | null;
  valid_to?: string | null;
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
      price_rule_type: 'fixed',
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
      const updatedServices = [...localServices];
      updatedServices[index] = {
        ...updatedServices[index],
        service_id: serviceId,
        description: service.name,
      };
      setLocalServices(updatedServices);
      onChange(updatedServices);
    }
  };

  const handlePriceTypeChange = (index: number, priceType: 'hourly' | 'fixed') => {
    const updatedServices = [...localServices];
    updatedServices[index] = {
      ...updatedServices[index],
      price_rule_type: priceType,
      // Reset quantity to 1 when changing to hourly
      quantity: priceType === 'hourly' ? 1 : updatedServices[index].quantity,
    };
    setLocalServices(updatedServices);
    onChange(updatedServices);
  };

  // Calculate totals - only fixed services contribute to the total
  const fixedServicesTotal = localServices
    .filter((service) => (service.price_rule_type || 'fixed') === 'fixed')
    .reduce(
      (sum, service) => sum + calculateServiceTotal(service.quantity, service.price_value || service.unit_price || 0),
      0
    );

  const hourlyServices = localServices.filter(
    (service) => service.price_rule_type === 'hourly'
  );

  const getServiceTotal = (service: ContractService) => {
    const priceType = service.price_rule_type || 'fixed';
    const price = service.price_value || service.unit_price || 0;
    
    if (priceType === 'hourly') {
      return price; // Just the hourly rate
    }
    return calculateServiceTotal(service.quantity, price);
  };

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

      {localServices.length > 0 && (
        <div className="grid grid-cols-12 gap-2 px-3 text-xs font-medium text-muted-foreground">
          <div className="col-span-2">Servicio</div>
          <div className="col-span-2">Especialista</div>
          <div className="col-span-2">Tipo Precio</div>
          <div className="col-span-1">Cant.</div>
          <div className="col-span-1">Precio</div>
          <div className="col-span-2">Frecuencia</div>
          <div className="col-span-1 text-right">Total</div>
          <div className="col-span-1"></div>
        </div>
      )}

      <div className="space-y-3">
        {localServices.map((service, index) => {
          const priceType = service.price_rule_type || 'fixed';
          const isHourly = priceType === 'hourly';
          
          return (
            <div
              key={index}
              className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-card"
            >
              <div className="col-span-2">
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

              <div className="col-span-2">
                <Select
                  value={priceType}
                  onValueChange={(value) => handlePriceTypeChange(index, value as 'hourly' | 'fixed')}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Precio Fijo</SelectItem>
                    <SelectItem value="hourly">Por Hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                {isHourly ? (
                  <div className="h-10 flex items-center justify-center text-muted-foreground">
                    —
                  </div>
                ) : (
                  <Input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={service.quantity || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleServiceChange(index, 'quantity', val === '' ? 1 : parseInt(val) || 1);
                    }}
                    disabled={disabled}
                  />
                )}
              </div>

              <div className="col-span-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={isHourly ? '€/h' : '€/Ud.'}
                  value={(service.price_value || service.unit_price) || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleServiceChange(index, 'price_value', val === '' ? 0 : parseFloat(val) || 0);
                  }}
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

              <div className="col-span-1 flex items-center justify-end font-semibold text-sm">
                {isHourly ? (
                  <span className="text-muted-foreground">
                    {formatCurrency(getServiceTotal(service))}/h
                  </span>
                ) : (
                  formatCurrency(getServiceTotal(service))
                )}
              </div>

              <div className="col-span-1 flex items-center justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveService(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {localServices.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No hay servicios. Haz clic en "Añadir Servicio" para comenzar.
        </div>
      )}

      <div className="flex flex-col gap-2 pt-4 border-t">
        {hourlyServices.length > 0 && (
          <div className="flex justify-end items-center gap-4 text-sm text-muted-foreground">
            <span>Tarifas por hora:</span>
            <span>
              {hourlyServices.map((s, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {formatCurrency(s.price_value || s.unit_price || 0)}/h
                </span>
              ))}
              <span className="ml-1">(variable)</span>
            </span>
          </div>
        )}
        <div className="flex justify-end items-center gap-4">
          <span className="text-lg font-semibold">
            Total {hourlyServices.length > 0 ? '(fijos)' : ''}:
          </span>
          <span className="text-2xl font-bold">{formatCurrency(fixedServicesTotal)}</span>
        </div>
      </div>
    </div>
  );
};
