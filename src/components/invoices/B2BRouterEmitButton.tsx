import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

interface Props {
  invoiceId: string;
  status: string;
  b2brouterInvoiceId?: string | null;
  b2brouterStatus?: string | null;
  size?: "sm" | "default";
}

export function B2BRouterEmitButton({
  invoiceId,
  status,
  b2brouterInvoiceId,
  b2brouterStatus,
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  if (b2brouterInvoiceId) {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        B2BRouter{b2brouterStatus ? `: ${b2brouterStatus}` : ""}
      </Badge>
    );
  }
  if (status !== "draft") return null;

  const emit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-b2brouter-invoice", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Factura emitida a B2BRouter");
        qc.invalidateQueries({ queryKey: ["invoices"] });
        setOpen(false);
      } else {
        toast.error(
          data?.error ??
            `Error B2BRouter (${data?.status ?? "?"}): ${
              typeof data?.response === "string"
                ? data.response
                : JSON.stringify(data?.response)?.slice(0, 300)
            }`,
        );
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        title="Emitir a B2BRouter"
      >
        <Send className="h-4 w-4 mr-1" />
        B2BRouter
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir factura a B2BRouter</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará la factura al entorno configurado en B2BRouter. Verifica
              datos fiscales del emisor y del cliente antes de confirmar. Esta
              acción solo debería hacerse una vez la factura esté revisada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                emit();
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Confirmar emisión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
