export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      zones: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
      };
      circles: {
        Row: {
          id: string;
          name: string;
          zone_id: string | null;
          state: string;
          discom: string;
          contract_ref: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          zone_id?: string | null;
          state?: string;
          discom?: string;
          contract_ref?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["circles"]["Insert"]>;
      };
      divisions: {
        Row: { id: string; name: string; circle_id: string; created_at: string };
        Insert: { id?: string; name: string; circle_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["divisions"]["Insert"]>;
      };
      substations: {
        Row: { id: string; name: string; division_id: string; created_at: string };
        Insert: { id?: string; name: string; division_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["substations"]["Insert"]>;
      };
      vehicles: {
        Row: {
          id: string;
          registration_no: string;
          vehicle_type: string | null;
          fuel_type: string | null;
          model_year: number | null;
          owner_name: string | null;
          owner_mobile: string | null;
          vendor_name: string | null;
          gps_company: string | null;
          gps_device_id: string | null;
          circle_id: string;
          insurance_expiry: string | null;
          fitness_expiry: string | null;
          pollution_expiry: string | null;
          rc_copy_url: string | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_no: string;
          vehicle_type?: string | null;
          fuel_type?: string | null;
          model_year?: number | null;
          owner_name?: string | null;
          owner_mobile?: string | null;
          vendor_name?: string | null;
          gps_company?: string | null;
          gps_device_id?: string | null;
          circle_id: string;
          insurance_expiry?: string | null;
          fitness_expiry?: string | null;
          pollution_expiry?: string | null;
          rc_copy_url?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
      };
      vehicle_assignments: {
        Row: {
          id: string;
          vehicle_id: string;
          circle_id: string;
          division_id: string;
          substation_id: string;
          assigned_from: string;
          assigned_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          circle_id: string;
          division_id: string;
          substation_id: string;
          assigned_from: string;
          assigned_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicle_assignments"]["Insert"]>;
      };
      drivers: {
        Row: {
          id: string;
          name: string;
          mobile: string | null;
          license_no: string | null;
          license_expiry: string | null;
          address: string | null;
          circle_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          mobile?: string | null;
          license_no?: string | null;
          license_expiry?: string | null;
          address?: string | null;
          circle_id: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drivers"]["Insert"]>;
      };
    };
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: {
      transfer_vehicle: {
        Args: {
          p_vehicle_id: string;
          p_to_circle_id: string;
          p_to_division_id: string;
          p_to_substation_id: string;
          p_transfer_date: string;
          p_reason: string;
          p_approved_by: string;
          p_remarks?: string | null;
        };
        Returns: string;
      };
    };
  };
};

