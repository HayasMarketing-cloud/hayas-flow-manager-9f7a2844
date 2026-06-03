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
      <div className="container mx-auto py-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plug className="h-6 w-6 text-primary" />
              <CardTitle>B2BRouter — Configuración</CardTitle>
            </div>
            <CardDescription>
              Configuración de la integración con B2BRouter para emisión de facturas electrónicas.
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
                onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>Entorno</Label>
              <Select
                value={config.environment}
                onValueChange={(v: "staging" | "production") =>
                  setConfig({ ...config, environment: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                onChange={(e) => setConfig({ ...config, api_version: e.target.value })}
                placeholder="2026-03-02"
              />
            </div>

            <div className="space-y-2">
              <Label>Account ID — Staging</Label>
              <Input
                value={config.account_id_staging ?? ""}
                onChange={(e) => setConfig({ ...config, account_id_staging: e.target.value })}
                placeholder="260492"
              />
            </div>

            <div className="space-y-2">
              <Label>Account ID — Production</Label>
              <Input
                value={config.account_id_production ?? ""}
                onChange={(e) => setConfig({ ...config, account_id_production: e.target.value })}
                placeholder="(pendiente)"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
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
      </div>
    </AppLayout>
  );
}
