import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useSpecialistDetail } from "@/hooks/useSpecialistDetail";
import { SpecialistFormModal } from "@/components/modals/SpecialistFormModal";
import { LiquidationStatusBadge } from "@/components/liquidations/LiquidationStatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil, Mail, Globe, Users, FileText, Download, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

const typeLabels: Record<string, string> = {
  interno: "Interno",
  freelance: "Freelance",
  partner: "Partner",
};

const typeColors: Record<string, string> = {
  interno: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  freelance: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  partner: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("es-ES") : "—";

export default function EspecialistaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, canAccessOperations, loading: rolesLoading } = useUserRole();
  const { specialist, liquidations, isLoading } = useSpecialistDetail(id);
  const [editOpen, setEditOpen] = useState(false);

  const canView = isAdmin() || canAccessOperations();
  const canEdit = isAdmin();

  if (rolesLoading || isLoading) {
    return (
      <AppLayout title="Detalle Especialista" description="">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!canView) {
    return (
      <AppLayout title="Detalle Especialista" description="">
        <p className="text-muted-foreground py-12 text-center">
          No tienes permisos para ver esta sección.
        </p>
      </AppLayout>
    );
  }

  if (!specialist) {
    return (
      <AppLayout title="Detalle Especialista" description="">
        <div className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">Especialista no encontrado.</p>
          <Button onClick={() => navigate("/especialistas")} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
        </div>
      </AppLayout>
    );
  }

  const liquidationsWithInvoice = liquidations.filter(l => l.specialist_invoice_url);

  return (
    <AppLayout title={specialist.name} description="Detalle del especialista">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate("/especialistas")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        {canEdit && (
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
        )}
      </div>

      {/* Header info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl">{specialist.name}</CardTitle>
            {specialist.type && (
              <Badge variant="secondary" className={typeColors[specialist.type]}>
                {typeLabels[specialist.type]}
              </Badge>
            )}
            <Badge variant={specialist.active ? "default" : "secondary"}>
              {specialist.active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {specialist.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${specialist.email}`} className="hover:underline">
                {specialist.email}
              </a>
            </div>
          )}
          {specialist.website_url && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <a
                href={specialist.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate"
              >
                {specialist.website_url}
              </a>
            </div>
          )}
          {specialist.hourly_rate != null && (
            <div className="text-sm">
              <span className="text-muted-foreground">Tarifa por hora: </span>
              <span className="font-medium">{formatCurrency(specialist.hourly_rate)}</span>
            </div>
          )}
          {specialist.team_leader_id && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
              <span>Miembro de equipo</span>
            </div>
          )}
          {specialist.notes && (
            <div className="sm:col-span-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {specialist.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="liquidations">
        <TabsList>
          <TabsTrigger value="liquidations">
            Liquidaciones ({liquidations.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Facturas recibidas ({liquidationsWithInvoice.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="liquidations">
          <Card>
            <CardContent className="p-0">
              {liquidations.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">
                  No hay liquidaciones para este especialista.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Fecha pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liquidations.map((l) => (
                      <TableRow
                        key={l.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/liquidaciones/${l.id}`)}
                      >
                        <TableCell className="font-medium">{l.code}</TableCell>
                        <TableCell>
                          {monthNames[l.period_month - 1]} {l.period_year}
                        </TableCell>
                        <TableCell>
                          <LiquidationStatusBadge status={l.status as any} />
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(l.subtotal)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(l.total_amount)}
                        </TableCell>
                        <TableCell>{formatDate(l.paid_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              {liquidationsWithInvoice.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">
                  El especialista aún no ha enviado facturas.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Liquidación</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Subida</TableHead>
                      <TableHead>Verificación</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liquidationsWithInvoice.map((l) => {
                      const verified = l.signature?.invoice_verification?.matches === true;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">
                            <button
                              className="hover:underline text-left"
                              onClick={() => navigate(`/liquidaciones/${l.id}`)}
                            >
                              {l.code}
                            </button>
                          </TableCell>
                          <TableCell>
                            {monthNames[l.period_month - 1]} {l.period_year}
                          </TableCell>
                          <TableCell>
                            {formatDate(l.signature?.invoice_uploaded_at ?? null)}
                          </TableCell>
                          <TableCell>
                            {l.signature?.invoice_verification ? (
                              verified ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> OK
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <AlertCircle className="mr-1 h-3 w-3" /> Discrepancia
                                </Badge>
                              )
                            ) : (
                              <Badge variant="secondary">
                                <FileText className="mr-1 h-3 w-3" /> Sin verificar
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                              >
                                <a
                                  href={l.specialist_invoice_url!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="mr-1 h-3 w-3" /> Ver
                                </a>
                              </Button>
                              <Button size="sm" variant="outline" asChild>
                                <a
                                  href={l.specialist_invoice_url!}
                                  download
                                >
                                  <Download className="mr-1 h-3 w-3" /> Descargar
                                </a>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SpecialistFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        specialist={specialist as any}
      />
    </AppLayout>
  );
}
