import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { SpecialistFormModal } from "@/components/modals/SpecialistFormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Mail, Pencil, User, Users } from "lucide-react";

type SpecialistType = "interno" | "freelance" | "partner";

interface Specialist {
  id: string;
  name: string;
  email: string | null;
  type: SpecialistType | null;
  active: boolean;
  hourly_rate: number | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  team_leader_id: string | null;
}

const typeLabels: Record<SpecialistType, string> = {
  interno: "Interno",
  freelance: "Freelance",
  partner: "Partner",
};

const typeColors: Record<SpecialistType, string> = {
  interno: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  freelance: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  partner: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export default function Especialistas() {
  const { isAdmin, canAccessOperations, loading: rolesLoading } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);

  const { data: specialists, isLoading } = useQuery({
    queryKey: ["specialists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialists")
        .select("id, name, email, type, active, notes, user_id, created_at, hourly_rate, team_leader_id")
        .order("name");
      if (error) throw error;
      return data as Specialist[];
    },
  });

  const filteredSpecialists = useMemo(() => {
    if (!specialists) return [];
    
    return specialists.filter((specialist) => {
      // Search filter
      const matchesSearch = specialist.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      
      // Type filter
      const matchesType =
        typeFilter === "all" || specialist.type === typeFilter;
      
      // Status filter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && specialist.active) ||
        (statusFilter === "inactive" && !specialist.active);
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [specialists, searchTerm, typeFilter, statusFilter]);

  const handleEdit = (specialist: Specialist) => {
    setSelectedSpecialist(specialist);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedSpecialist(null);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setSelectedSpecialist(null);
    }
  };

  const canEdit = isAdmin();
  const canView = isAdmin() || canAccessOperations();

  if (rolesLoading) {
    return (
      <AppLayout title="Especialistas" description="Gestión de especialistas">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!canView) {
    return (
      <AppLayout title="Especialistas" description="Gestión de especialistas">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            No tienes permisos para ver esta sección.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Especialistas" description="Gestión de especialistas">
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="interno">Interno</SelectItem>
              <SelectItem value="freelance">Freelance</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Especialista
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredSpecialists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {specialists?.length === 0 ? (
            <>
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No hay especialistas registrados.
              </p>
              {canEdit && (
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primer especialista
                </Button>
              )}
            </>
          ) : (
            <>
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No se encontraron especialistas con los filtros aplicados.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSpecialists.map((specialist) => (
            <Card key={specialist.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold">
                    {specialist.name}
                  </CardTitle>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(specialist)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {specialist.type && (
                  <Badge
                    variant="secondary"
                    className={typeColors[specialist.type]}
                  >
                    {typeLabels[specialist.type]}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {specialist.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{specialist.email}</span>
                  </div>
                )}
                
                {specialist.user_id && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Vinculado a usuario</span>
                  </div>
                )}

                {specialist.team_leader_id && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Users className="h-4 w-4" />
                    <span>Miembro de equipo</span>
                  </div>
                )}

                <div className="pt-2">
                  <Badge variant={specialist.active ? "default" : "secondary"}>
                    {specialist.active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <SpecialistFormModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        specialist={selectedSpecialist}
      />
    </AppLayout>
  );
}
