import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Plug, Save } from "lucide-react";

type Config = {
  id: string;
  account_id_staging: string | null;
  account_id_production: string | null;
  environment: "staging" | "production";
  api_version: string;
  enabled: boolean;
  issuer_name: string | null;
  issuer_tax_id: string | null;
  issuer_address: string | null;
  issuer_postal_code: string | null;
  issuer_city: string | null;
  issuer_province: string | null;
  issuer_country_code: string | null;
  issuer_iban: string | null;
  issuer_email: string | null;
  issuer_phone: string | null;
  invoice_series: string | null;
  default_payment_terms_days: number | null;
  default_payment_means: string | null;
};

export default function B2BRouterSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [result, setResult] = useState<{ ok: boolean; payload: any } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("b2brouter_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) toast.error(error.message);
      setConfig(data as Config | null);
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof Config>(k: K, v: Config[K]) =>
    setConfig((c) => (c ? { ...c, [k]: v } : c));

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("b2brouter_config")
      .update({
        account_id_staging: config.account_id_staging,
        account_id_production: config.account_id_production,
        environment: config.environment,
        api_version: config.api_version,
        enabled: config.enabled,
        issuer_name: config.issuer_name,
        issuer_tax_id: config.issuer_tax_id,
        issuer_address: config.issuer_address,
        issuer_postal_code: config.issuer_postal_code,
        issuer_city: config.issuer_city,
        issuer_province: config.issuer_province,
        issuer_country_code: config.issuer_country_code,
        issuer_iban: config.issuer_iban,
        issuer_email: config.issuer_email,
        issuer_phone: config.issuer_phone,
        invoice_series: config.invoice_series,
        default_payment_terms_days: config.default_payment_terms_days,
        default_payment_means: config.default_payment_means,
      })
      .eq("id", config.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configuración guardada");
  };

  const testConnection = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("b2brouter-test-connection");
      if (error) throw error;
      setResult({ ok: !!data?.ok, payload: data });
      if (data?.ok) toast.success("Conexión OK");
      else toast.error(`Error ${data?.status ?? ""}`);
    } catch (e: any) {
      setResult({ ok: false, payload: { error: e.message } });
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!config) {
    return (
      <AppLayout>
        <div className="container mx-auto py-10">
          <Alert variant="destructive">
            <AlertTitle>Sin configuración</AlertTitle>
            <AlertDescription>No se encontró registro en b2brouter_config.</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plug className="h-6 w-6 text-primary" />
              <CardTitle>B2BRouter — Conexión</CardTitle>
            </div>
            <CardDescription>
              Credenciales y entorno de B2BRouter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-base">Integración activa</Label>
                <p className="text-sm text-muted-foreground">
                  Habilita el envío de facturas a B2BRouter.
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => update("enabled", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Entorno</Label>
                <Select
                  value={config.environment}
                  onValueChange={(v: "staging" | "production") => update("environment", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staging">Staging (pruebas)</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>API Version</Label>
                <Input
                  value={config.api_version}
                  onChange={(e) => update("api_version", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Account ID — Staging</Label>
                <Input
                  value={config.account_id_staging ?? ""}
                  onChange={(e) => update("account_id_staging", e.target.value)}
                  placeholder="260492"
                />
              </div>
              <div className="space-y-2">
                <Label>Account ID — Production</Label>
                <Input
                  value={config.account_id_production ?? ""}
                  onChange={(e) => update("account_id_production", e.target.value)}
                  placeholder="(pendiente)"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
                Probar conexión
              </Button>
            </div>

            {result && (
              <Alert variant={result.ok ? "default" : "destructive"}>
                {result.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <AlertTitle>{result.ok ? "Conexión exitosa" : "Error de conexión"}</AlertTitle>
                <AlertDescription>
                  <pre className="mt-2 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                    {JSON.stringify(result.payload, null, 2)}
                  </pre>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos fiscales del emisor</CardTitle>
            <CardDescription>
              Información de la empresa que firma las facturas en B2BRouter.
              Obligatorios: nombre, NIF, dirección, CP, ciudad y país.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Razón social / Nombre fiscal *</Label>
                <Input
                  value={config.issuer_name ?? ""}
                  onChange={(e) => update("issuer_name", e.target.value)}
                  placeholder="HAYAS MARKETING SL"
                />
              </div>
              <div className="space-y-2">
                <Label>NIF / CIF *</Label>
                <Input
                  value={config.issuer_tax_id ?? ""}
                  onChange={(e) => update("issuer_tax_id", e.target.value)}
                  placeholder="B12345678"
                />
              </div>
              <div className="space-y-2">
                <Label>País (ISO 2) *</Label>
                <Input
                  value={config.issuer_country_code ?? "ES"}
                  onChange={(e) => update("issuer_country_code", e.target.value.toUpperCase())}
                  maxLength={2}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Dirección *</Label>
                <Input
                  value={config.issuer_address ?? ""}
                  onChange={(e) => update("issuer_address", e.target.value)}
                  placeholder="Calle ... nº ..."
                />
              </div>
              <div className="space-y-2">
                <Label>Código postal *</Label>
                <Input
                  value={config.issuer_postal_code ?? ""}
                  onChange={(e) => update("issuer_postal_code", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ciudad *</Label>
                <Input
                  value={config.issuer_city ?? ""}
                  onChange={(e) => update("issuer_city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Provincia</Label>
                <Input
                  value={config.issuer_province ?? ""}
                  onChange={(e) => update("issuer_province", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email facturación</Label>
                <Input
                  type="email"
                  value={config.issuer_email ?? ""}
                  onChange={(e) => update("issuer_email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={config.issuer_phone ?? ""}
                  onChange={(e) => update("issuer_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>IBAN cobro</Label>
                <Input
                  value={config.issuer_iban ?? ""}
                  onChange={(e) => update("issuer_iban", e.target.value)}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Defaults de factura</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Serie</Label>
              <Input
                value={config.invoice_series ?? "F"}
                onChange={(e) => update("invoice_series", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Plazo pago (días)</Label>
              <Input
                type="number"
                value={config.default_payment_terms_days ?? 30}
                onChange={(e) => update("default_payment_terms_days", parseInt(e.target.value || "0"))}
              />
            </div>
            <div className="space-y-2">
              <Label>Medio de pago</Label>
              <Select
                value={config.default_payment_means ?? "transfer"}
                onValueChange={(v) => update("default_payment_means", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="direct_debit">Domiciliación</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar configuración
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
