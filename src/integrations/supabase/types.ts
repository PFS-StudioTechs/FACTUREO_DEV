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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          adresse: string
          code_postal: string
          company_id: string
          conditions_paiement: number
          created_at: string
          descriptif_mission: string
          id: string
          mode_paiement: string
          nom: string
          numero_bon_commande: string
          siret: string | null
          tjm: number
          updated_at: string
          user_id: string
          ville: string
        }
        Insert: {
          adresse?: string
          code_postal?: string
          company_id: string
          conditions_paiement?: number
          created_at?: string
          descriptif_mission?: string
          id?: string
          mode_paiement?: string
          nom?: string
          numero_bon_commande?: string
          siret?: string | null
          tjm?: number
          updated_at?: string
          user_id: string
          ville?: string
        }
        Update: {
          adresse?: string
          code_postal?: string
          company_id?: string
          conditions_paiement?: number
          created_at?: string
          descriptif_mission?: string
          id?: string
          mode_paiement?: string
          nom?: string
          numero_bon_commande?: string
          siret?: string | null
          tjm?: number
          updated_at?: string
          user_id?: string
          ville?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          adresse: string
          banque_adresse: string
          banque_nom: string
          banque_titulaire: string
          bic_swift: string
          capital: string
          code_iban: string
          code_naf: string
          code_postal: string
          created_at: string
          denomination: string
          designation: string
          forme_juridique: string
          id: string
          mail: string
          mail_envoi: string
          nom_contact: string
          rcs_rm_ville: string
          siret: string
          telephone: string
          tva_intracommunautaire: string
          updated_at: string
          user_id: string
          ville: string
        }
        Insert: {
          adresse?: string
          banque_adresse?: string
          banque_nom?: string
          banque_titulaire?: string
          bic_swift?: string
          capital?: string
          code_iban?: string
          code_naf?: string
          code_postal?: string
          created_at?: string
          denomination?: string
          designation?: string
          forme_juridique?: string
          id?: string
          mail?: string
          mail_envoi?: string
          nom_contact?: string
          rcs_rm_ville?: string
          siret?: string
          telephone?: string
          tva_intracommunautaire?: string
          updated_at?: string
          user_id: string
          ville?: string
        }
        Update: {
          adresse?: string
          banque_adresse?: string
          banque_nom?: string
          banque_titulaire?: string
          bic_swift?: string
          capital?: string
          code_iban?: string
          code_naf?: string
          code_postal?: string
          created_at?: string
          denomination?: string
          designation?: string
          forme_juridique?: string
          id?: string
          mail?: string
          mail_envoi?: string
          nom_contact?: string
          rcs_rm_ville?: string
          siret?: string
          telephone?: string
          tva_intracommunautaire?: string
          updated_at?: string
          user_id?: string
          ville?: string
        }
        Relationships: []
      }
      expense_scans: {
        Row: {
          created_at: string
          file_url: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      forecast_months: {
        Row: {
          created_at: string
          forecast_id: string
          id: string
          month: number
          planned_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          forecast_id: string
          id?: string
          month: number
          planned_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          forecast_id?: string
          id?: string
          month?: number
          planned_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_months_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      forecasts: {
        Row: {
          created_at: string
          id: string
          mission_name: string
          tjm: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          mission_name?: string
          tjm?: number
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          mission_name?: string
          tjm?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      invoice_settings: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          next_number: number
          numero_format: string
          prefix: string
          separator: string
          suffix_date_format: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string
          company_id: string
          created_at?: string
          id?: string
          next_number?: number
          numero_format?: string
          prefix?: string
          separator?: string
          suffix_date_format?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          next_number?: number
          numero_format?: string
          prefix?: string
          separator?: string
          suffix_date_format?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          designation: string
          id: string
          invoice_id: string
          montant_ht: number
          montant_ttc: number
          montant_tva: number
          motif_exoneration: string
          position: number
          prix_unitaire_ht: number
          quantite: number
          remise: number
          taux_tva: number
          unite: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          designation?: string
          id?: string
          invoice_id: string
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          motif_exoneration?: string
          position?: number
          prix_unitaire_ht?: number
          quantite?: number
          remise?: number
          taux_tva?: number
          unite?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          designation?: string
          id?: string
          invoice_id?: string
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          motif_exoneration?: string
          position?: number
          prix_unitaire_ht?: number
          quantite?: number
          remise?: number
          taux_tva?: number
          unite?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          company_id: string
          conditions_paiement: number
          created_at: string
          date_facturation: string
          date_limite_paiement: string
          descriptif_mission: string
          designation: string
          facture_source_id: string | null
          facturx_url: string | null
          id: string
          mode_paiement: string
          montant_ht: number
          montant_ttc: number
          montant_tva: number
          nombre_jours: number | null
          numero_bon_commande: string
          numero_facture: string
          sent_at: string | null
          status: string | null
          taux_tva: number
          tjm: number | null
          type: string
          type_piece: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          company_id: string
          conditions_paiement?: number
          created_at?: string
          date_facturation?: string
          date_limite_paiement?: string
          descriptif_mission?: string
          designation?: string
          facture_source_id?: string | null
          facturx_url?: string | null
          id?: string
          mode_paiement?: string
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          nombre_jours?: number | null
          numero_bon_commande?: string
          numero_facture?: string
          sent_at?: string | null
          status?: string | null
          taux_tva?: number
          tjm?: number | null
          type?: string
          type_piece?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          company_id?: string
          conditions_paiement?: number
          created_at?: string
          date_facturation?: string
          date_limite_paiement?: string
          descriptif_mission?: string
          designation?: string
          facture_source_id?: string | null
          facturx_url?: string | null
          id?: string
          mode_paiement?: string
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          nombre_jours?: number | null
          numero_bon_commande?: string
          numero_facture?: string
          sent_at?: string | null
          status?: string | null
          taux_tva?: number
          tjm?: number | null
          type?: string
          type_piece?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          archived: boolean
          created_at: string
          email: string
          id: string
          pseudo: string
          telephone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          email?: string
          id?: string
          pseudo?: string
          telephone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          email?: string
          id?: string
          pseudo?: string
          telephone?: string
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      archive_user: { Args: { _user_id: string }; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
