export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          created_at: string
          description: string
          id: string
          notes: string | null
          quantity: number
          service_id: string | null
          specialist_id: string | null
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          quantity?: number
          service_id?: string | null
          specialist_id?: string | null
          total: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          quantity?: number
          service_id?: string | null
          specialist_id?: string | null
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          accepted_document_url: string | null
          am_user_id: string | null
          client_contact_id: string | null
          client_id: string
          client_po_number: string | null
          code: string
          contract_id: string | null
          created_at: string
          created_by: string
          description: string | null
          estimated_invoice_date: string | null
          id: string
          pm_user_id: string | null
          proposal_context: Json | null
          status: string
          title: string
          total_amount: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_document_url?: string | null
          am_user_id?: string | null
          client_contact_id?: string | null
          client_id: string
          client_po_number?: string | null
          code?: string
          contract_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          estimated_invoice_date?: string | null
          id?: string
          pm_user_id?: string | null
          proposal_context?: Json | null
          status?: string
          title: string
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_document_url?: string | null
          am_user_id?: string | null
          client_contact_id?: string | null
          client_id?: string
          client_po_number?: string | null
          code?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_invoice_date?: string | null
          id?: string
          pm_user_id?: string | null
          proposal_context?: Json | null
          status?: string
          title?: string
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_am_user_id_fkey"
            columns: ["am_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_pm_user_id_fkey"
            columns: ["pm_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          active: boolean | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          client_id: string
          country: string | null
          created_at: string | null
          created_by: string
          email: string
          id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          role: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          client_id: string
          country?: string | null
          created_at?: string | null
          created_by: string
          email: string
          id?: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          client_id?: string
          country?: string | null
          created_at?: string | null
          created_by?: string
          email?: string
          id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          billing_emails: string[] | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string
          created_by: string
          default_hourly_rate: number | null
          drive_folder_url: string | null
          email: string | null
          expected_payment_day: number | null
          hub_client_url: string | null
          id: string
          invoice_day: number | null
          name: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          phone: string | null
          status: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_emails?: string[] | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          default_hourly_rate?: number | null
          drive_folder_url?: string | null
          email?: string | null
          expected_payment_day?: number | null
          hub_client_url?: string | null
          id?: string
          invoice_day?: number | null
          name: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          phone?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_emails?: string[] | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          default_hourly_rate?: number | null
          drive_folder_url?: string | null
          email?: string | null
          expected_payment_day?: number | null
          hub_client_url?: string | null
          id?: string
          invoice_day?: number | null
          name?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          phone?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      commission_settings: {
        Row: {
          commission_type: string
          default_percentage: number
          id: string
          updated_at: string | null
        }
        Insert: {
          commission_type: string
          default_percentage: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          commission_type?: string
          default_percentage?: number
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contract_services: {
        Row: {
          billing_frequency:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          contract_id: string
          created_at: string
          description: string
          id: string
          notes: string | null
          price_rule_type: Database["public"]["Enums"]["price_rule_type"] | null
          price_value: number
          project_type: string | null
          quantity: number
          service_id: string | null
          specialist_id: string | null
          updated_at: string
        }
        Insert: {
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          contract_id: string
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          price_rule_type?:
            | Database["public"]["Enums"]["price_rule_type"]
            | null
          price_value: number
          project_type?: string | null
          quantity?: number
          service_id?: string | null
          specialist_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          contract_id?: string
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          price_rule_type?:
            | Database["public"]["Enums"]["price_rule_type"]
            | null
          price_value?: number
          project_type?: string | null
          quantity?: number
          service_id?: string | null
          specialist_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_services_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          am_user_id: string | null
          attached_contract_url: string | null
          client_id: string
          client_po_number: string | null
          code: string
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          created_at: string
          created_by: string
          description: string | null
          enable_auto_requests: boolean | null
          end_date: string | null
          hub_project_url: string | null
          id: string
          is_on_demand: boolean
          pm_user_id: string | null
          seller_id: string | null
          specialists_default: string[] | null
          start_date: string | null
          status: string
          title: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          am_user_id?: string | null
          attached_contract_url?: string | null
          client_id: string
          client_po_number?: string | null
          code?: string
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          created_by: string
          description?: string | null
          enable_auto_requests?: boolean | null
          end_date?: string | null
          hub_project_url?: string | null
          id?: string
          is_on_demand?: boolean
          pm_user_id?: string | null
          seller_id?: string | null
          specialists_default?: string[] | null
          start_date?: string | null
          status?: string
          title: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          am_user_id?: string | null
          attached_contract_url?: string | null
          client_id?: string
          client_po_number?: string | null
          code?: string
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          created_by?: string
          description?: string | null
          enable_auto_requests?: boolean | null
          end_date?: string | null
          hub_project_url?: string | null
          id?: string
          is_on_demand?: boolean
          pm_user_id?: string | null
          seller_id?: string | null
          specialists_default?: string[] | null
          start_date?: string | null
          status?: string
          title?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_am_user_id_fkey"
            columns: ["am_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_pm_user_id_fkey"
            columns: ["pm_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_requests: {
        Row: {
          billed_invoice_id: string | null
          budget_id: string | null
          budget_item_id: string | null
          client_contact_id: string | null
          client_id: string
          code: string
          completed_at: string | null
          contract_id: string | null
          cost_rate: number | null
          cost_to_agency: number | null
          cost_type: Database["public"]["Enums"]["cost_type"] | null
          created_at: string
          deadline: string | null
          description: string | null
          fixed_cost: number | null
          hours: number | null
          id: string
          liquidation_id: string | null
          partner_reference: string | null
          quantity: number
          sale_amount: number | null
          sale_hours: number | null
          sale_rate: number | null
          sale_type: Database["public"]["Enums"]["price_rule_type"] | null
          service_id: string
          specialist_acceptance: boolean | null
          specialist_id: string | null
          status: Database["public"]["Enums"]["financial_request_status"]
          title: string
          unit_price: number | null
          updated_at: string
          work_month: number | null
          work_year: number | null
        }
        Insert: {
          billed_invoice_id?: string | null
          budget_id?: string | null
          budget_item_id?: string | null
          client_contact_id?: string | null
          client_id: string
          code: string
          completed_at?: string | null
          contract_id?: string | null
          cost_rate?: number | null
          cost_to_agency?: number | null
          cost_type?: Database["public"]["Enums"]["cost_type"] | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          fixed_cost?: number | null
          hours?: number | null
          id?: string
          liquidation_id?: string | null
          partner_reference?: string | null
          quantity?: number
          sale_amount?: number | null
          sale_hours?: number | null
          sale_rate?: number | null
          sale_type?: Database["public"]["Enums"]["price_rule_type"] | null
          service_id: string
          specialist_acceptance?: boolean | null
          specialist_id?: string | null
          status?: Database["public"]["Enums"]["financial_request_status"]
          title: string
          unit_price?: number | null
          updated_at?: string
          work_month?: number | null
          work_year?: number | null
        }
        Update: {
          billed_invoice_id?: string | null
          budget_id?: string | null
          budget_item_id?: string | null
          client_contact_id?: string | null
          client_id?: string
          code?: string
          completed_at?: string | null
          contract_id?: string | null
          cost_rate?: number | null
          cost_to_agency?: number | null
          cost_type?: Database["public"]["Enums"]["cost_type"] | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          fixed_cost?: number | null
          hours?: number | null
          id?: string
          liquidation_id?: string | null
          partner_reference?: string | null
          quantity?: number
          sale_amount?: number | null
          sale_hours?: number | null
          sale_rate?: number | null
          sale_type?: Database["public"]["Enums"]["price_rule_type"] | null
          service_id?: string
          specialist_acceptance?: boolean | null
          specialist_id?: string | null
          status?: Database["public"]["Enums"]["financial_request_status"]
          title?: string
          unit_price?: number | null
          updated_at?: string
          work_month?: number | null
          work_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_requests_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_requests_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_requests_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_billed_invoice_id_fkey"
            columns: ["billed_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_liquidation_id_fkey"
            columns: ["liquidation_id"]
            isOneToOne: false
            referencedRelation: "liquidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_budget_allocations: {
        Row: {
          allocated_amount: number
          budget_id: string
          created_at: string | null
          id: string
          invoice_id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          allocated_amount: number
          budget_id: string
          created_at?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          allocated_amount?: number
          budget_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_budget_allocations_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_budget_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          aggregated_request_ids: string[] | null
          created_at: string
          description: string
          financial_request_id: string | null
          id: string
          invoice_id: string
          quantity: number
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          aggregated_request_ids?: string[] | null
          created_at?: string
          description: string
          financial_request_id?: string | null
          id?: string
          invoice_id: string
          quantity?: number
          total: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          aggregated_request_ids?: string[] | null
          created_at?: string
          description?: string
          financial_request_id?: string | null
          id?: string
          invoice_id?: string
          quantity?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_request_id_fkey"
            columns: ["financial_request_id"]
            isOneToOne: false
            referencedRelation: "financial_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          allocated_amount: number
          created_at: string | null
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string | null
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string | null
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_period_month: number | null
          billing_period_year: number | null
          budget_id: string | null
          client_id: string
          code: string
          contract_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          notes: string | null
          paid_at: string | null
          pdf_url: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_period_month?: number | null
          billing_period_year?: number | null
          budget_id?: string | null
          client_id: string
          code: string
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          billing_period_month?: number | null
          billing_period_year?: number | null
          budget_id?: string | null
          client_id?: string
          code?: string
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidation_items: {
        Row: {
          created_at: string
          description: string
          financial_request_id: string | null
          id: string
          liquidation_id: string
          quantity: number
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          financial_request_id?: string | null
          id?: string
          liquidation_id: string
          quantity?: number
          total: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          financial_request_id?: string | null
          id?: string
          liquidation_id?: string
          quantity?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidation_items_liquidation_id_fkey"
            columns: ["liquidation_id"]
            isOneToOne: false
            referencedRelation: "liquidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidation_items_request_id_fkey"
            columns: ["financial_request_id"]
            isOneToOne: false
            referencedRelation: "financial_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidation_signatures: {
        Row: {
          created_at: string | null
          dispute_reason: string | null
          expires_at: string
          id: string
          invoice_uploaded_at: string | null
          invoice_verification: Json | null
          ip_address: string | null
          liquidation_id: string
          signed_at: string | null
          specialist_comments: string | null
          status: string | null
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          dispute_reason?: string | null
          expires_at: string
          id?: string
          invoice_uploaded_at?: string | null
          invoice_verification?: Json | null
          ip_address?: string | null
          liquidation_id: string
          signed_at?: string | null
          specialist_comments?: string | null
          status?: string | null
          token?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          dispute_reason?: string | null
          expires_at?: string
          id?: string
          invoice_uploaded_at?: string | null
          invoice_verification?: Json | null
          ip_address?: string | null
          liquidation_id?: string
          signed_at?: string | null
          specialist_comments?: string | null
          status?: string | null
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidation_signatures_liquidation_id_fkey"
            columns: ["liquidation_id"]
            isOneToOne: false
            referencedRelation: "liquidations"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidations: {
        Row: {
          code: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          pdf_url: string | null
          period_month: number
          period_year: number
          sent_at: string | null
          specialist_id: string
          specialist_invoice_url: string | null
          status: Database["public"]["Enums"]["liquidation_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          period_month: number
          period_year: number
          sent_at?: string | null
          specialist_id: string
          specialist_invoice_url?: string | null
          status?: Database["public"]["Enums"]["liquidation_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          period_month?: number
          period_year?: number
          sent_at?: string | null
          specialist_id?: string
          specialist_invoice_url?: string | null
          status?: Database["public"]["Enums"]["liquidation_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidations_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          category: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_projects: {
        Row: {
          budget_id: string | null
          client_id: string
          contract_id: string | null
          created_at: string | null
          created_by: string
          deadline: string | null
          description: string | null
          drive_folder_url: string | null
          hub_client_url: string | null
          hub_project_url: string | null
          id: string
          name: string
          owner_user_id: string | null
          status: Database["public"]["Enums"]["operational_status"] | null
          updated_at: string | null
          work_month: number | null
          work_year: number | null
        }
        Insert: {
          budget_id?: string | null
          client_id: string
          contract_id?: string | null
          created_at?: string | null
          created_by: string
          deadline?: string | null
          description?: string | null
          drive_folder_url?: string | null
          hub_client_url?: string | null
          hub_project_url?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["operational_status"] | null
          updated_at?: string | null
          work_month?: number | null
          work_year?: number | null
        }
        Update: {
          budget_id?: string | null
          client_id?: string
          contract_id?: string | null
          created_at?: string | null
          created_by?: string
          deadline?: string | null
          description?: string | null
          drive_folder_url?: string | null
          hub_client_url?: string | null
          hub_project_url?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["operational_status"] | null
          updated_at?: string | null
          work_month?: number | null
          work_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_projects_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_requests: {
        Row: {
          assignee_specialist_id: string | null
          assignee_user_id: string | null
          client_id: string
          context_url: string | null
          created_at: string | null
          created_by: string
          deadline: string | null
          description: string | null
          financial_request_id: string | null
          id: string
          name: string
          notes: string | null
          operational_project_id: string
          reviewer_type: Database["public"]["Enums"]["reviewer_type"] | null
          status: Database["public"]["Enums"]["operational_status"] | null
          updated_at: string | null
        }
        Insert: {
          assignee_specialist_id?: string | null
          assignee_user_id?: string | null
          client_id: string
          context_url?: string | null
          created_at?: string | null
          created_by: string
          deadline?: string | null
          description?: string | null
          financial_request_id?: string | null
          id?: string
          name: string
          notes?: string | null
          operational_project_id: string
          reviewer_type?: Database["public"]["Enums"]["reviewer_type"] | null
          status?: Database["public"]["Enums"]["operational_status"] | null
          updated_at?: string | null
        }
        Update: {
          assignee_specialist_id?: string | null
          assignee_user_id?: string | null
          client_id?: string
          context_url?: string | null
          created_at?: string | null
          created_by?: string
          deadline?: string | null
          description?: string | null
          financial_request_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          operational_project_id?: string
          reviewer_type?: Database["public"]["Enums"]["reviewer_type"] | null
          status?: Database["public"]["Enums"]["operational_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_requests_assignee_specialist_id_fkey"
            columns: ["assignee_specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_requests_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_requests_financial_request_id_fkey"
            columns: ["financial_request_id"]
            isOneToOne: false
            referencedRelation: "financial_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_requests_operational_project_id_fkey"
            columns: ["operational_project_id"]
            isOneToOne: false
            referencedRelation: "operational_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account: string | null
          code: string
          created_at: string | null
          created_by: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_account?: string | null
          code: string
          created_at?: string | null
          created_by: string
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_account?: string | null
          code?: string
          created_at?: string | null
          created_by?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reference?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_action_tokens: {
        Row: {
          acted_at: string | null
          action_type: string
          comments: string | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          request_id: string
          status: string | null
          token: string
          user_agent: string | null
        }
        Insert: {
          acted_at?: string | null
          action_type: string
          comments?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          request_id: string
          status?: string | null
          token?: string
          user_agent?: string | null
        }
        Update: {
          acted_at?: string | null
          action_type?: string
          comments?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          request_id?: string
          status?: string | null
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_action_tokens_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "financial_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_commissions: {
        Row: {
          base_amount: number
          budget_id: string | null
          commission_amount: number
          commission_percentage: number
          commission_type: string
          contract_id: string | null
          created_at: string | null
          id: string
          invoice_ids: string[] | null
          liquidation_id: string | null
          notes: string | null
          paid_at: string | null
          seller_user_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          base_amount?: number
          budget_id?: string | null
          commission_amount: number
          commission_percentage: number
          commission_type: string
          contract_id?: string | null
          created_at?: string | null
          id?: string
          invoice_ids?: string[] | null
          liquidation_id?: string | null
          notes?: string | null
          paid_at?: string | null
          seller_user_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          base_amount?: number
          budget_id?: string | null
          commission_amount?: number
          commission_percentage?: number
          commission_type?: string
          contract_id?: string | null
          created_at?: string | null
          id?: string
          invoice_ids?: string[] | null
          liquidation_id?: string | null
          notes?: string | null
          paid_at?: string | null
          seller_user_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_commissions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_liquidation_id_fkey"
            columns: ["liquidation_id"]
            isOneToOne: false
            referencedRelation: "liquidations"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string
          current_value: number
          id: string
          name: string
          prefix: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          name: string
          prefix: string
          updated_at?: string
          year?: number
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          name?: string
          prefix?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          id: string
          name: string
          template_structure: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name: string
          template_structure?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name?: string
          template_structure?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      specialists: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          email: string | null
          hourly_rate: number | null
          id: string
          name: string
          notes: string | null
          team_leader_id: string | null
          type: Database["public"]["Enums"]["specialist_type"] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name: string
          notes?: string | null
          team_leader_id?: string | null
          type?: Database["public"]["Enums"]["specialist_type"] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name?: string
          notes?: string | null
          team_leader_id?: string | null
          type?: Database["public"]["Enums"]["specialist_type"] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specialists_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_specialist_id: string | null
          assignee_user_id: string | null
          context_url: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          operational_request_id: string | null
          order_index: number | null
          status: Database["public"]["Enums"]["operational_status"] | null
          updated_at: string | null
        }
        Insert: {
          assignee_specialist_id?: string | null
          assignee_user_id?: string | null
          context_url?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          operational_request_id?: string | null
          order_index?: number | null
          status?: Database["public"]["Enums"]["operational_status"] | null
          updated_at?: string | null
        }
        Update: {
          assignee_specialist_id?: string | null
          assignee_user_id?: string | null
          context_url?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          operational_request_id?: string | null
          order_index?: number | null
          status?: Database["public"]["Enums"]["operational_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_specialist_id_fkey"
            columns: ["assignee_specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_operational_request_id_fkey"
            columns: ["operational_request_id"]
            isOneToOne: false
            referencedRelation: "operational_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          roles: Database["public"]["Enums"]["app_role"][]
          status: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          roles?: Database["public"]["Enums"]["app_role"][]
          status?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_code: { Args: { sequence_name: string }; Returns: string }
      get_current_specialist_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_specialist_liquidation: {
        Args: { _liquidation_id: string }
        Returns: boolean
      }
      link_my_specialist: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "finanzas"
        | "project_manager"
        | "especialista"
        | "account_manager"
        | "seller"
      billing_frequency: "monthly" | "one_time" | "per_project" | "on_demand"
      contract_type: "retainer" | "project" | "one_time"
      cost_type: "hourly" | "fixed"
      financial_request_status:
        | "draft"
        | "pending_specialist"
        | "pending_approval"
        | "in_progress"
        | "pending_review"
        | "completed"
        | "cancelled"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      liquidation_status:
        | "draft"
        | "validated"
        | "sent"
        | "accepted"
        | "invoice_received"
        | "pending_payment"
        | "paid"
        | "disputed"
      operational_status: "pending" | "in_progress" | "in_review" | "completed"
      payment_method: "stripe" | "credit_card" | "sdd" | "bank_transfer"
      price_rule_type: "hourly" | "fixed"
      request_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "in_progress"
        | "completed"
        | "billed"
        | "cancelled"
      reviewer_type: "am" | "client"
      specialist_type: "interno" | "freelance" | "partner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "finanzas",
        "project_manager",
        "especialista",
        "account_manager",
        "seller",
      ],
      billing_frequency: ["monthly", "one_time", "per_project", "on_demand"],
      contract_type: ["retainer", "project", "one_time"],
      cost_type: ["hourly", "fixed"],
      financial_request_status: [
        "draft",
        "pending_specialist",
        "pending_approval",
        "in_progress",
        "pending_review",
        "completed",
        "cancelled",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      liquidation_status: [
        "draft",
        "validated",
        "sent",
        "accepted",
        "invoice_received",
        "pending_payment",
        "paid",
        "disputed",
      ],
      operational_status: ["pending", "in_progress", "in_review", "completed"],
      payment_method: ["stripe", "credit_card", "sdd", "bank_transfer"],
      price_rule_type: ["hourly", "fixed"],
      request_status: [
        "draft",
        "pending_approval",
        "approved",
        "in_progress",
        "completed",
        "billed",
        "cancelled",
      ],
      reviewer_type: ["am", "client"],
      specialist_type: ["interno", "freelance", "partner"],
    },
  },
} as const
