import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TestEmail = () => {
  const { user } = useAuth();
  const [toEmail, setToEmail] = useState("devops@hayas.es");
  const [subject, setSubject] = useState("Test Gmail API - Hayas Hub");
  const [body, setBody] = useState("Este es un email de prueba para verificar la configuración de Gmail API con Service Account.");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);

  const fromEmail = user?.email || "";

  const handleSendTest = async () => {
    if (!fromEmail.endsWith("@hayas.es")) {
      toast.error("Debes iniciar sesión con un email @hayas.es");
      return;
    }

    if (!toEmail || !subject || !body) {
      toast.error("Todos los campos son requeridos");
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-email", {
        body: {
          fromEmail,
          toEmail,
          subject,
          body
        }
      });

      if (error) throw error;

      if (data.success) {
        setResult({
          success: true,
          message: `Email enviado correctamente a ${toEmail}`,
          messageId: data.messageId
        });
        toast.success("Email enviado correctamente");
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      setResult({
        success: false,
        message: error.message || "Error al enviar el email"
      });
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              <CardTitle>Test Email - Gmail API</CardTitle>
            </div>
            <CardDescription>
              Prueba el envío de emails usando Gmail API con Service Account.
              El email será enviado desde tu cuenta @hayas.es.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="from">De (remitente)</Label>
              <Input
                id="from"
                value={fromEmail}
                disabled
                className="bg-muted"
              />
              {!fromEmail.endsWith("@hayas.es") && (
                <p className="text-sm text-destructive">
                  ⚠️ Debes iniciar sesión con un email @hayas.es
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="to">Para (destinatario)</Label>
              <Input
                id="to"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="destinatario@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Asunto</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Asunto del email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Mensaje</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Contenido del email..."
                rows={5}
              />
            </div>

            <Button
              onClick={handleSendTest}
              disabled={isSending || !fromEmail.endsWith("@hayas.es")}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Email de Prueba
                </>
              )}
            </Button>

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {result.success ? "¡Éxito!" : "Error"}
                </AlertTitle>
                <AlertDescription>
                  {result.message}
                  {result.messageId && (
                    <p className="mt-1 text-xs font-mono">
                      Message ID: {result.messageId}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Instrucciones de prueba:</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Asegúrate de estar logueado con <strong>ruben@hayas.es</strong> o <strong>devops@hayas.es</strong></li>
                <li>El email se enviará desde tu cuenta usando Gmail API</li>
                <li>El destinatario recibirá el email como si lo hubieras enviado tú</li>
                <li>Revisa la bandeja de entrada del destinatario para confirmar</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default TestEmail;
