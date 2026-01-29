import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/layout/AppLayout";
import { ServiceFormModal, SERVICE_CATEGORIES, ServiceWithTemplate } from "@/components/modals/ServiceFormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Package } from "lucide-react";

type Service = ServiceWithTemplate & {
  created_at: string;
};

const categoryColors: Record<string, string> = {
  'Branding & Creatividad': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Desarrollo de aplicaciones': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Estrategia & Consultoría': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Web & UX': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Content & Translations': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Paid Media': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Email & Automatización': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'CRM & Datos': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Formación / Mentoring': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Interno / No facturable': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export default function Servicios() {
  const { isAdmin, loading: rolesLoading } = useUserRole();
  const canManage = isAdmin();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const { data: services, isLoading, error } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as unknown as Service[];
    },
  });

  const filteredServices = services?.filter((service) => {
    const matchesSearch = service.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || service.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? service.active : !service.active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleEdit = (service: Service) => {
    setSelectedService(service);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedService(null);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setSelectedService(null);
    }
  };

  if (error) {
    return (
      <AppLayout title="Servicios" description="Gestión de servicios">
        <div className="text-center py-12">
          <p className="text-destructive">Error al cargar los servicios</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Servicios" description="Gestión de servicios">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {SERVICE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        {canManage && (
          <Button onClick={handleCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Servicio
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading || rolesLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredServices?.length === 0 ? (
        services?.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No hay servicios"
            description="Crea tu primer servicio para comenzar a usarlo en presupuestos, contratos y solicitudes."
            action={
              canManage
                ? {
                    label: "Crear Servicio",
                    onClick: handleCreate,
                    icon: Plus,
                  }
                : undefined
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="No se encontraron servicios con los filtros aplicados."
          />
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices?.map((service) => (
            <Card key={service.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold line-clamp-1">
                    {service.name}
                  </CardTitle>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleEdit(service)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3">
                {service.category && (
                  <Badge
                    variant="secondary"
                    className={categoryColors[service.category] || ""}
                  >
                    {service.category}
                  </Badge>
                )}

                {service.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {service.description}
                  </p>
                )}

                <div className="mt-auto pt-2">
                  <Badge variant={service.active ? "default" : "outline"}>
                    {service.active ? "● Activo" : "○ Inactivo"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <ServiceFormModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        service={selectedService}
      />
    </AppLayout>
  );
}
