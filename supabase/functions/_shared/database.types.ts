Initialising login role...
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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          resource: string | null
          status: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          resource?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          resource?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      agent_evaluations: {
        Row: {
          agent_id: string | null
          anomaly_details: string | null
          anomaly_detected: boolean | null
          created_at: string | null
          id: string
          lead_id: string | null
          message_text: string
          score: number | null
          tone_analysis: string | null
        }
        Insert: {
          agent_id?: string | null
          anomaly_details?: string | null
          anomaly_detected?: boolean | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          message_text: string
          score?: number | null
          tone_analysis?: string | null
        }
        Update: {
          agent_id?: string | null
          anomaly_details?: string | null
          anomaly_detected?: boolean | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          message_text?: string
          score?: number | null
          tone_analysis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_evaluations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          category: string
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          category: string
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          academic_record: Json | null
          alergias: string | null
          alimentacion: string | null
          apellido: string | null
          ciudad: string | null
          cp: string | null
          created_at: string | null
          dieta: string | null
          email: string | null
          estado: string | null
          financial_status: string | null
          grupo: string | null
          id: string
          internal_notes: Json | null
          lead_id: string | null
          motivo_curso: string | null
          nombre: string | null
          origen_contacto: string | null
          pais: string | null
          tags: string[] | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          academic_record?: Json | null
          alergias?: string | null
          alimentacion?: string | null
          apellido?: string | null
          ciudad?: string | null
          cp?: string | null
          created_at?: string | null
          dieta?: string | null
          email?: string | null
          estado?: string | null
          financial_status?: string | null
          grupo?: string | null
          id?: string
          internal_notes?: Json | null
          lead_id?: string | null
          motivo_curso?: string | null
          nombre?: string | null
          origen_contacto?: string | null
          pais?: string | null
          tags?: string[] | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_record?: Json | null
          alergias?: string | null
          alimentacion?: string | null
          apellido?: string | null
          ciudad?: string | null
          cp?: string | null
          created_at?: string | null
          dieta?: string | null
          email?: string | null
          estado?: string | null
          financial_status?: string | null
          grupo?: string | null
          id?: string
          internal_notes?: Json | null
          lead_id?: string | null
          motivo_curso?: string | null
          nombre?: string | null
          origen_contacto?: string | null
          pais?: string | null
          tags?: string[] | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          created_at: string | null
          delivery_status: string | null
          emisor: string | null
          id: string
          lead_id: string | null
          mensaje: string
          message_id: string | null
          metadata: Json | null
          platform: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_status?: string | null
          emisor?: string | null
          id?: string
          lead_id?: string | null
          mensaje: string
          message_id?: string | null
          metadata?: Json | null
          platform?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_status?: string | null
          emisor?: string | null
          id?: string
          lead_id?: string | null
          mensaje?: string
          message_id?: string | null
          metadata?: Json | null
          platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_installments: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          installment_number: number
          paid_at: string | null
          reminder_sent_at: string | null
          sale_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          installment_number: number
          paid_at?: string | null
          reminder_sent_at?: string | null
          sale_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          paid_at?: string | null
          reminder_sent_at?: string | null
          sale_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "credit_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_sales: {
        Row: {
          concept: string
          contact_id: string | null
          created_at: string | null
          currency: string | null
          down_payment: number | null
          id: string
          msg_abandon_agent: string | null
          msg_post1: string | null
          msg_post2: string | null
          msg_pre: string | null
          precio_original: number | null
          precio_tipo: string | null
          responsible_id: string | null
          seq_abandon_days: number | null
          seq_post1_days: number | null
          seq_post2_days: number | null
          seq_pre_days: number | null
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          concept: string
          contact_id?: string | null
          created_at?: string | null
          currency?: string | null
          down_payment?: number | null
          id?: string
          msg_abandon_agent?: string | null
          msg_post1?: string | null
          msg_post2?: string | null
          msg_pre?: string | null
          precio_original?: number | null
          precio_tipo?: string | null
          responsible_id?: string | null
          seq_abandon_days?: number | null
          seq_post1_days?: number | null
          seq_post2_days?: number | null
          seq_pre_days?: number | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          concept?: string
          contact_id?: string | null
          created_at?: string | null
          currency?: string | null
          down_payment?: number | null
          id?: string
          msg_abandon_agent?: string | null
          msg_post1?: string | null
          msg_post2?: string | null
          msg_pre?: string | null
          precio_original?: number | null
          precio_tipo?: string | null
          responsible_id?: string | null
          seq_abandon_days?: number | null
          seq_post1_days?: number | null
          seq_post2_days?: number | null
          seq_pre_days?: number | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      errores_ia: {
        Row: {
          aplicada_en_version: string | null
          applied_at: string | null
          categoria: string | null
          cliente_id: string | null
          conversacion_id: string | null
          conversaciones_afectadas: number | null
          correccion_explicacion: string | null
          correccion_sugerida: string | null
          created_by: string | null
          error_id: string
          estado_correccion: string | null
          mensaje_cliente: string | null
          reported_at: string | null
          respuesta_ia: string | null
          severidad: string | null
          tasa_mejora_post: number | null
          usuario_id: string | null
        }
        Insert: {
          aplicada_en_version?: string | null
          applied_at?: string | null
          categoria?: string | null
          cliente_id?: string | null
          conversacion_id?: string | null
          conversaciones_afectadas?: number | null
          correccion_explicacion?: string | null
          correccion_sugerida?: string | null
          created_by?: string | null
          error_id?: string
          estado_correccion?: string | null
          mensaje_cliente?: string | null
          reported_at?: string | null
          respuesta_ia?: string | null
          severidad?: string | null
          tasa_mejora_post?: number | null
          usuario_id?: string | null
        }
        Update: {
          aplicada_en_version?: string | null
          applied_at?: string | null
          categoria?: string | null
          cliente_id?: string | null
          conversacion_id?: string | null
          conversaciones_afectadas?: number | null
          correccion_explicacion?: string | null
          correccion_sugerida?: string | null
          created_by?: string | null
          error_id?: string
          estado_correccion?: string | null
          mensaje_cliente?: string | null
          reported_at?: string | null
          respuesta_ia?: string | null
          severidad?: string | null
          tasa_mejora_post?: number | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      followup_config: {
        Row: {
          allowed_days: string[] | null
          auto_restart_delay: number | null
          created_at: string | null
          enabled: boolean | null
          end_hour: number | null
          id: string
          max_followup_stage: number | null
          stage_1_delay: number | null
          stage_1_message: string | null
          stage_2_delay: number | null
          stage_2_message: string | null
          stage_3_delay: number | null
          stage_3_message: string | null
          start_hour: number | null
          strategy_type: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_days?: string[] | null
          auto_restart_delay?: number | null
          created_at?: string | null
          enabled?: boolean | null
          end_hour?: number | null
          id?: string
          max_followup_stage?: number | null
          stage_1_delay?: number | null
          stage_1_message?: string | null
          stage_2_delay?: number | null
          stage_2_message?: string | null
          stage_3_delay?: number | null
          stage_3_message?: string | null
          start_hour?: number | null
          strategy_type?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_days?: string[] | null
          auto_restart_delay?: number | null
          created_at?: string | null
          enabled?: boolean | null
          end_hour?: number | null
          id?: string
          max_followup_stage?: number | null
          stage_1_delay?: number | null
          stage_1_message?: string | null
          stage_2_delay?: number | null
          stage_2_message?: string | null
          stage_3_delay?: number | null
          stage_3_message?: string | null
          start_hour?: number | null
          strategy_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      followup_history: {
        Row: {
          id: string
          lead_id: string | null
          message_sent: string | null
          sent_at: string | null
          stage: number | null
        }
        Insert: {
          id?: string
          lead_id?: string | null
          message_sent?: string | null
          sent_at?: string | null
          stage?: number | null
        }
        Update: {
          id?: string
          lead_id?: string | null
          message_sent?: string | null
          sent_at?: string | null
          stage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_corregiria: {
        Row: {
          aplicado: boolean | null
          aplicado_en_version: string | null
          categoria: string | null
          cliente_estado_emocional: string | null
          correccion_propuesta: string | null
          corregiria_id: string
          error_id: string | null
          fecha_aplicacion: string | null
          feedback_reporte: string | null
          impacto_esperado: string | null
          mejora_detectada: boolean | null
          mensaje_original: string | null
          patron_identificado: string | null
          prompt_version_en_uso: string | null
          razon_cambio: string | null
          reportado_en_kommo: boolean | null
          reportado_por: string | null
          subcategoria: string | null
          test_antes_promedio: number | null
          test_despues_promedio: number | null
          timestamp_reporte: string | null
          usuario_valida: boolean | null
        }
        Insert: {
          aplicado?: boolean | null
          aplicado_en_version?: string | null
          categoria?: string | null
          cliente_estado_emocional?: string | null
          correccion_propuesta?: string | null
          corregiria_id?: string
          error_id?: string | null
          fecha_aplicacion?: string | null
          feedback_reporte?: string | null
          impacto_esperado?: string | null
          mejora_detectada?: boolean | null
          mensaje_original?: string | null
          patron_identificado?: string | null
          prompt_version_en_uso?: string | null
          razon_cambio?: string | null
          reportado_en_kommo?: boolean | null
          reportado_por?: string | null
          subcategoria?: string | null
          test_antes_promedio?: number | null
          test_despues_promedio?: number | null
          timestamp_reporte?: string | null
          usuario_valida?: boolean | null
        }
        Update: {
          aplicado?: boolean | null
          aplicado_en_version?: string | null
          categoria?: string | null
          cliente_estado_emocional?: string | null
          correccion_propuesta?: string | null
          corregiria_id?: string
          error_id?: string | null
          fecha_aplicacion?: string | null
          feedback_reporte?: string | null
          impacto_esperado?: string | null
          mejora_detectada?: boolean | null
          mensaje_original?: string | null
          patron_identificado?: string | null
          prompt_version_en_uso?: string | null
          razon_cambio?: string | null
          reportado_en_kommo?: boolean | null
          reportado_por?: string | null
          subcategoria?: string | null
          test_antes_promedio?: number | null
          test_despues_promedio?: number | null
          timestamp_reporte?: string | null
          usuario_valida?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_corregiria_error_id_fkey"
            columns: ["error_id"]
            isOneToOne: false
            referencedRelation: "errores_ia"
            referencedColumns: ["error_id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          category: string
          content: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          external_link: string | null
          file_path: string | null
          file_url: string | null
          id: string
          size: string | null
          title: string
          type: string
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          external_link?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          size?: string | null
          title: string
          type: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          external_link?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          size?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          ai_paused: boolean | null
          apellido: string | null
          assigned_to: string | null
          buying_intent: string | null
          capi_lead_event_sent_at: string | null
          channel_id: string | null
          ciudad: string | null
          confidence_score: number | null
          cp: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          estado_emocional_actual: string | null
          followup_stage: number | null
          id: string
          kommo_id: string | null
          last_ai_analysis: string | null
          last_message_at: string | null
          lead_score: number | null
          main_pain: string | null
          next_followup_at: string | null
          nombre: string | null
          origen_contacto: string | null
          pais: string | null
          payment_status: string | null
          perfil_psicologico: string | null
          preferencias: string | null
          reminders: Json | null
          servicio_interes: string | null
          summary: string | null
          tags: string[] | null
          telefono: string | null
          tiempo_compra: string | null
        }
        Insert: {
          ai_paused?: boolean | null
          apellido?: string | null
          assigned_to?: string | null
          buying_intent?: string | null
          capi_lead_event_sent_at?: string | null
          channel_id?: string | null
          ciudad?: string | null
          confidence_score?: number | null
          cp?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          estado_emocional_actual?: string | null
          followup_stage?: number | null
          id?: string
          kommo_id?: string | null
          last_ai_analysis?: string | null
          last_message_at?: string | null
          lead_score?: number | null
          main_pain?: string | null
          next_followup_at?: string | null
          nombre?: string | null
          origen_contacto?: string | null
          pais?: string | null
          payment_status?: string | null
          perfil_psicologico?: string | null
          preferencias?: string | null
          reminders?: Json | null
          servicio_interes?: string | null
          summary?: string | null
          tags?: string[] | null
          telefono?: string | null
          tiempo_compra?: string | null
        }
        Update: {
          ai_paused?: boolean | null
          apellido?: string | null
          assigned_to?: string | null
          buying_intent?: string | null
          capi_lead_event_sent_at?: string | null
          channel_id?: string | null
          ciudad?: string | null
          confidence_score?: number | null
          cp?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          estado_emocional_actual?: string | null
          followup_stage?: number | null
          id?: string
          kommo_id?: string | null
          last_ai_analysis?: string | null
          last_message_at?: string | null
          lead_score?: number | null
          main_pain?: string | null
          next_followup_at?: string | null
          nombre?: string | null
          origen_contacto?: string | null
          pais?: string | null
          payment_status?: string | null
          perfil_psicologico?: string | null
          preferencias?: string | null
          reminders?: Json | null
          servicio_interes?: string | null
          summary?: string | null
          tags?: string[] | null
          telefono?: string | null
          tiempo_compra?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      main_website_content: {
        Row: {
          content: string | null
          content_length: number | null
          created_at: string | null
          error_message: string | null
          id: string
          last_scraped_at: string | null
          scrape_status: string | null
          title: string | null
          url: string
        }
        Insert: {
          content?: string | null
          content_length?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_scraped_at?: string | null
          scrape_status?: string | null
          title?: string | null
          url: string
        }
        Update: {
          content?: string | null
          content_length?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_scraped_at?: string | null
          scrape_status?: string | null
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          ai_instructions: string | null
          category: string | null
          created_at: string | null
          friday_concert: boolean | null
          id: string
          nivel: string | null
          normal_price: number | null
          ocr_content: string | null
          presale_ends_at: string | null
          presale_price: number | null
          profesor: string | null
          sede: string | null
          tags: string[] | null
          title: string | null
          type: string | null
          url: string | null
          valid_until: string | null
        }
        Insert: {
          ai_instructions?: string | null
          category?: string | null
          created_at?: string | null
          friday_concert?: boolean | null
          id?: string
          nivel?: string | null
          normal_price?: number | null
          ocr_content?: string | null
          presale_ends_at?: string | null
          presale_price?: number | null
          profesor?: string | null
          sede?: string | null
          tags?: string[] | null
          title?: string | null
          type?: string | null
          url?: string | null
          valid_until?: string | null
        }
        Update: {
          ai_instructions?: string | null
          category?: string | null
          created_at?: string | null
          friday_concert?: boolean | null
          id?: string
          nivel?: string | null
          normal_price?: number | null
          ocr_content?: string | null
          presale_ends_at?: string | null
          presale_price?: number | null
          profesor?: string | null
          sede?: string | null
          tags?: string[] | null
          title?: string | null
          type?: string | null
          url?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      meta_capi_events: {
        Row: {
          created_at: string | null
          event_id: string | null
          event_name: string
          id: string
          lead_id: string | null
          meta_response: Json | null
          payload_sent: Json | null
          status: string | null
          unhashed_data: Json | null
          value: number | null
          whatsapp_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          event_name: string
          id?: string
          lead_id?: string | null
          meta_response?: Json | null
          payload_sent?: Json | null
          status?: string | null
          unhashed_data?: Json | null
          value?: number | null
          whatsapp_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          event_name?: string
          id?: string
          lead_id?: string | null
          meta_response?: Json | null
          payload_sent?: Json | null
          status?: string | null
          unhashed_data?: Json | null
          value?: number | null
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          role: string | null
          territories: string[] | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: string | null
          territories?: string[] | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string | null
          territories?: string[] | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          id: string
          notes: string | null
          prompts_snapshot: Json
          version_name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          notes?: string | null
          prompts_snapshot: Json
          version_name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          notes?: string | null
          prompts_snapshot?: Json
          version_name?: string
        }
        Relationships: []
      }
      versiones_prompts_aprendidas: {
        Row: {
          activated_at: string | null
          contenido_anterior: string | null
          contenido_nuevo: string | null
          creado_por: string | null
          created_at: string | null
          diff_aplicados: Json | null
          errores_corregidia: number | null
          lista_errores_ids: Json | null
          mejora_porcentaje: number | null
          motivo_creacion: string | null
          prompt_nombre: string | null
          test_accuracy_anterior: number | null
          test_accuracy_nuevo: number | null
          trigger_version_anterior: string | null
          usuarios_lo_usaron: number | null
          version_id: string
          version_numero: string | null
        }
        Insert: {
          activated_at?: string | null
          contenido_anterior?: string | null
          contenido_nuevo?: string | null
          creado_por?: string | null
          created_at?: string | null
          diff_aplicados?: Json | null
          errores_corregidia?: number | null
          lista_errores_ids?: Json | null
          mejora_porcentaje?: number | null
          motivo_creacion?: string | null
          prompt_nombre?: string | null
          test_accuracy_anterior?: number | null
          test_accuracy_nuevo?: number | null
          trigger_version_anterior?: string | null
          usuarios_lo_usaron?: number | null
          version_id?: string
          version_numero?: string | null
        }
        Update: {
          activated_at?: string | null
          contenido_anterior?: string | null
          contenido_nuevo?: string | null
          creado_por?: string | null
          created_at?: string | null
          diff_aplicados?: Json | null
          errores_corregidia?: number | null
          lista_errores_ids?: Json | null
          mejora_porcentaje?: number | null
          motivo_creacion?: string | null
          prompt_nombre?: string | null
          test_accuracy_anterior?: number | null
          test_accuracy_nuevo?: number | null
          trigger_version_anterior?: string | null
          usuarios_lo_usaron?: number | null
          version_id?: string
          version_numero?: string | null
        }
        Relationships: []
      }
      whatsapp_channels: {
        Row: {
          ai_mode: string | null
          api_key: string
          api_url: string
          created_at: string | null
          id: string
          instance_id: string | null
          is_active: boolean | null
          name: string
          phone_number: string | null
          provider: string
          updated_at: string | null
          verify_token: string | null
        }
        Insert: {
          ai_mode?: string | null
          api_key: string
          api_url: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          name: string
          phone_number?: string | null
          provider: string
          updated_at?: string | null
          verify_token?: string | null
        }
        Update: {
          ai_mode?: string | null
          api_key?: string
          api_url?: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          name?: string
          phone_number?: string | null
          provider?: string
          updated_at?: string | null
          verify_token?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
