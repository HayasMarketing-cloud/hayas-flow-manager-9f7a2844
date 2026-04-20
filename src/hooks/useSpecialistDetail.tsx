import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SpecialistDetail {
  id: string;
  name: string;
  email: string | null;
  type: "interno" | "freelance" | "partner" | null;
  active: boolean;
  hourly_rate: number | null;
  website_url: string | null;
  notes: string | null;
  user_id: string | null;
  team_leader_id: string | null;
  created_at: string;
}

export interface SpecialistLiquidation {
  id: string;
  code: string;
  period_year: number;
  period_month: number;
  status: string;
  subtotal: number;
  total_amount: number;
  paid_at: string | null;
  specialist_invoice_url: string | null;
  created_at: string;
  signature?: {
    invoice_uploaded_at: string | null;
    invoice_verification: any;
    status: string | null;
  } | null;
}

export const useSpecialistDetail = (specialistId: string | undefined) => {
  const specialistQuery = useQuery({
    queryKey: ["specialist-detail", specialistId],
    enabled: !!specialistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialists")
        .select("id, name, email, type, active, hourly_rate, website_url, notes, user_id, team_leader_id, created_at")
        .eq("id", specialistId!)
        .maybeSingle();
      if (error) throw error;
      return data as SpecialistDetail | null;
    },
  });

  const liquidationsQuery = useQuery({
    queryKey: ["specialist-liquidations", specialistId],
    enabled: !!specialistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liquidations")
        .select(`
          id, code, period_year, period_month, status, subtotal, total_amount,
          paid_at, specialist_invoice_url, created_at,
          liquidation_signatures ( invoice_uploaded_at, invoice_verification, status )
        `)
        .eq("specialist_id", specialistId!)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        signature: l.liquidation_signatures?.[0] ?? null,
      })) as SpecialistLiquidation[];
    },
  });

  return {
    specialist: specialistQuery.data,
    liquidations: liquidationsQuery.data ?? [],
    isLoading: specialistQuery.isLoading || liquidationsQuery.isLoading,
    error: specialistQuery.error || liquidationsQuery.error,
  };
};
