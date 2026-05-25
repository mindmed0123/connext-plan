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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assinaturas: {
        Row: {
          cakto_customer_id: string | null
          cakto_subscription_id: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          empresa_id: string
          id: string
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          paddle_transaction_id: string | null
          periodo: Database["public"]["Enums"]["assinatura_periodo"]
          plano_id: string | null
          status: Database["public"]["Enums"]["assinatura_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cakto_customer_id?: string | null
          cakto_subscription_id?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          empresa_id: string
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string | null
          periodo?: Database["public"]["Enums"]["assinatura_periodo"]
          plano_id?: string | null
          status?: Database["public"]["Enums"]["assinatura_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cakto_customer_id?: string | null
          cakto_subscription_id?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          empresa_id?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string | null
          periodo?: Database["public"]["Enums"]["assinatura_periodo"]
          plano_id?: string | null
          status?: Database["public"]["Enums"]["assinatura_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          cakto_subscription_id: string | null
          created_at: string
          empresa_id: string | null
          event_id: string | null
          event_type: string
          id: string
          paddle_subscription_id: string | null
          payload: Json
          processed_at: string | null
        }
        Insert: {
          cakto_subscription_id?: string | null
          created_at?: string
          empresa_id?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          paddle_subscription_id?: string | null
          payload: Json
          processed_at?: string | null
        }
        Update: {
          cakto_subscription_id?: string | null
          created_at?: string
          empresa_id?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          paddle_subscription_id?: string | null
          payload?: Json
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cartao_despesas: {
        Row: {
          cartao_id: string
          categoria: string | null
          categoria_id: string | null
          comprador_id: string | null
          created_at: string
          created_by: string | null
          data_compra: string
          descricao: string
          empresa_id: string
          id: string
          obra_id: string | null
          observacoes: string | null
          parcelas: number
          updated_at: string
          valor: number
        }
        Insert: {
          cartao_id: string
          categoria?: string | null
          categoria_id?: string | null
          comprador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao: string
          empresa_id?: string
          id?: string
          obra_id?: string | null
          observacoes?: string | null
          parcelas?: number
          updated_at?: string
          valor?: number
        }
        Update: {
          cartao_id?: string
          categoria?: string | null
          categoria_id?: string | null
          comprador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao?: string
          empresa_id?: string
          id?: string
          obra_id?: string | null
          observacoes?: string | null
          parcelas?: number
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartao_despesas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes_credito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartao_despesas_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "compradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartao_despesas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_credito: {
        Row: {
          apelido: string
          ativo: boolean
          banco: string | null
          bandeira: string | null
          created_at: string
          created_by: string | null
          dia_fechamento: number | null
          dia_vencimento: number | null
          empresa_id: string
          id: string
          limite: number
          observacoes: string | null
          titular: string | null
          ultimos_4: string | null
          updated_at: string
        }
        Insert: {
          apelido: string
          ativo?: boolean
          banco?: string | null
          bandeira?: string | null
          created_at?: string
          created_by?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          empresa_id?: string
          id?: string
          limite?: number
          observacoes?: string | null
          titular?: string | null
          ultimos_4?: string | null
          updated_at?: string
        }
        Update: {
          apelido?: string
          ativo?: boolean
          banco?: string | null
          bandeira?: string | null
          created_at?: string
          created_by?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          empresa_id?: string
          id?: string
          limite?: number
          observacoes?: string | null
          titular?: string | null
          ultimos_4?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          empresa_id: string
          grupo: Database["public"]["Enums"]["categoria_grupo"]
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          empresa_id: string
          grupo: Database["public"]["Enums"]["categoria_grupo"]
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          empresa_id?: string
          grupo?: Database["public"]["Enums"]["categoria_grupo"]
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["lancamento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_servico: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cnpj: string
          created_at: string
          email: string | null
          empresa_id: string
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      compradores: {
        Row: {
          ativo: boolean
          cargo: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contratacoes_terceirizado: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          forma_pagamento_prevista:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id: string
          obra_id: string
          observacoes: string | null
          quantidade_parcelas: number
          status_financeiro: Database["public"]["Enums"]["contratacao_status"]
          terceirizado_id: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          forma_pagamento_prevista?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          obra_id: string
          observacoes?: string | null
          quantidade_parcelas?: number
          status_financeiro?: Database["public"]["Enums"]["contratacao_status"]
          terceirizado_id: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          forma_pagamento_prevista?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          obra_id?: string
          observacoes?: string | null
          quantidade_parcelas?: number
          status_financeiro?: Database["public"]["Enums"]["contratacao_status"]
          terceirizado_id?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratacoes_terceirizado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_terceirizado_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_terceirizado_terceirizado_id_fkey"
            columns: ["terceirizado_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_clientes: {
        Row: {
          cliente_id: string | null
          condicoes_pgto: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          documento_url: string | null
          empresa_id: string
          id: string
          numero_contrato: string | null
          objeto: string
          obra_id: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["contrato_cliente_status"]
          updated_at: string
          valor_global: number
        }
        Insert: {
          cliente_id?: string | null
          condicoes_pgto?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          documento_url?: string | null
          empresa_id: string
          id?: string
          numero_contrato?: string | null
          objeto: string
          obra_id?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["contrato_cliente_status"]
          updated_at?: string
          valor_global?: number
        }
        Update: {
          cliente_id?: string | null
          condicoes_pgto?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          documento_url?: string | null
          empresa_id?: string
          id?: string
          numero_contrato?: string | null
          objeto?: string
          obra_id?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["contrato_cliente_status"]
          updated_at?: string
          valor_global?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_clientes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_obra: {
        Row: {
          created_at: string
          data_envio: string
          empresa_id: string
          id: string
          obra_id: string
          observacoes: string
          status: Database["public"]["Enums"]["diario_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_envio?: string
          empresa_id?: string
          id?: string
          obra_id: string
          observacoes: string
          status?: Database["public"]["Enums"]["diario_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_envio?: string
          empresa_id?: string
          id?: string
          obra_id?: string
          observacoes?: string
          status?: Database["public"]["Enums"]["diario_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diario_obra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresa_dashboard_config: {
        Row: {
          cards_visiveis: string[]
          empresa_id: string
          updated_at: string
        }
        Insert: {
          cards_visiveis?: string[]
          empresa_id: string
          updated_at?: string
        }
        Update: {
          cards_visiveis?: string[]
          empresa_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_dashboard_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          nome: string
          onboarding_completo: boolean
          plano: string
          slug: string
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome: string
          onboarding_completo?: boolean
          plano?: string
          slug: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome?: string
          onboarding_completo?: boolean
          plano?: string
          slug?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      execucoes: {
        Row: {
          created_at: string
          data_inicio: string | null
          empresa_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          nome_terceirizado: string | null
          obra_id: string
          observacoes: string | null
          prazo_estimado: number | null
          responsavel_obra: string
          status: Database["public"]["Enums"]["execucao_status"]
          terceirizado_id: string | null
          tipo_execucao: Database["public"]["Enums"]["execucao_tipo"]
          updated_at: string
          valor_terceirizado: number
        }
        Insert: {
          created_at?: string
          data_inicio?: string | null
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          nome_terceirizado?: string | null
          obra_id: string
          observacoes?: string | null
          prazo_estimado?: number | null
          responsavel_obra: string
          status?: Database["public"]["Enums"]["execucao_status"]
          terceirizado_id?: string | null
          tipo_execucao?: Database["public"]["Enums"]["execucao_tipo"]
          updated_at?: string
          valor_terceirizado?: number
        }
        Update: {
          created_at?: string
          data_inicio?: string | null
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          nome_terceirizado?: string | null
          obra_id?: string
          observacoes?: string | null
          prazo_estimado?: number | null
          responsavel_obra?: string
          status?: Database["public"]["Enums"]["execucao_status"]
          terceirizado_id?: string | null
          tipo_execucao?: Database["public"]["Enums"]["execucao_tipo"]
          updated_at?: string
          valor_terceirizado?: number
        }
        Relationships: [
          {
            foreignKeyName: "execucoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucoes_terceirizado_id_fkey"
            columns: ["terceirizado_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_obra: {
        Row: {
          data_upload: string
          empresa_id: string
          id: string
          imagem_url: string
          obra_id: string
          observacao: string | null
          storage_path: string | null
          tipo: Database["public"]["Enums"]["foto_tipo"]
          uploaded_by: string | null
        }
        Insert: {
          data_upload?: string
          empresa_id?: string
          id?: string
          imagem_url: string
          obra_id: string
          observacao?: string | null
          storage_path?: string | null
          tipo: Database["public"]["Enums"]["foto_tipo"]
          uploaded_by?: string | null
        }
        Update: {
          data_upload?: string
          empresa_id?: string
          id?: string
          imagem_url?: string
          obra_id?: string
          observacao?: string | null
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["foto_tipo"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fotos_obra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_financeiros: {
        Row: {
          categoria_id: string | null
          comprovante_path: string | null
          comprovante_url: string | null
          created_at: string
          created_by: string | null
          data_competencia: string
          data_realizado: string | null
          data_vencimento: string | null
          descricao: string
          documento_num: string | null
          empresa_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          fornecedor_nome: string | null
          id: string
          obra_id: string | null
          observacoes: string | null
          origem: string | null
          origem_id: string | null
          pessoa_id: string | null
          status: Database["public"]["Enums"]["lancamento_status"]
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          comprovante_path?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data_competencia: string
          data_realizado?: string | null
          data_vencimento?: string | null
          descricao: string
          documento_num?: string | null
          empresa_id: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          fornecedor_nome?: string | null
          id?: string
          obra_id?: string | null
          observacoes?: string | null
          origem?: string | null
          origem_id?: string | null
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["lancamento_status"]
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria_id?: string | null
          comprovante_path?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data_competencia?: string
          data_realizado?: string | null
          data_vencimento?: string | null
          descricao?: string
          documento_num?: string | null
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          fornecedor_nome?: string | null
          id?: string
          obra_id?: string | null
          observacoes?: string | null
          origem?: string | null
          origem_id?: string | null
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["lancamento_status"]
          tipo?: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_financeiros_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_obra: {
        Row: {
          anexo_path: string | null
          anexo_url: string | null
          comprador_id: string | null
          created_at: string
          created_by: string | null
          data_compra: string
          descricao: string
          empresa_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          fornecedor: string | null
          id: string
          numero_nf: string | null
          obra_id: string
          observacoes: string | null
          quantidade: number
          unidade: string | null
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          anexo_path?: string | null
          anexo_url?: string | null
          comprador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao: string
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          fornecedor?: string | null
          id?: string
          numero_nf?: string | null
          obra_id: string
          observacoes?: string | null
          quantidade?: number
          unidade?: string | null
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          anexo_path?: string | null
          anexo_url?: string | null
          comprador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao?: string
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          fornecedor?: string | null
          id?: string
          numero_nf?: string | null
          obra_id?: string
          observacoes?: string | null
          quantidade?: number
          unidade?: string | null
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "materiais_obra_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "compradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_obra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_medicao: string
          empresa_id: string
          id: string
          numero_medicao: number
          obra_id: string | null
          observacoes: string | null
          percentual: number | null
          referencia: string | null
          status: Database["public"]["Enums"]["medicao_status"]
          updated_at: string
          valor_acumulado: number
          valor_medido: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_medicao: string
          empresa_id: string
          id?: string
          numero_medicao: number
          obra_id?: string | null
          observacoes?: string | null
          percentual?: number | null
          referencia?: string | null
          status?: Database["public"]["Enums"]["medicao_status"]
          updated_at?: string
          valor_acumulado?: number
          valor_medido?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_medicao?: string
          empresa_id?: string
          id?: string
          numero_medicao?: number
          obra_id?: string | null
          observacoes?: string | null
          percentual?: number | null
          referencia?: string | null
          status?: Database["public"]["Enums"]["medicao_status"]
          updated_at?: string
          valor_acumulado?: number
          valor_medido?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          arquivo_pdf_url: string | null
          codigo_chamado_avulso: string | null
          created_at: string
          data_emissao: string
          empresa_id: string
          id: string
          numero_nf: string
          obra_id: string | null
          pedido_compra_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          arquivo_pdf_url?: string | null
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_emissao: string
          empresa_id?: string
          id?: string
          numero_nf: string
          obra_id?: string | null
          pedido_compra_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          arquivo_pdf_url?: string | null
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_emissao?: string
          empresa_id?: string
          id?: string
          numero_nf?: string
          obra_id?: string | null
          pedido_compra_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_responsaveis: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          obra_id: string
          observacao: string | null
          papel: Database["public"]["Enums"]["obra_papel"]
          pessoa_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          obra_id: string
          observacao?: string | null
          papel: Database["public"]["Enums"]["obra_papel"]
          pessoa_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          obra_id?: string
          observacao?: string | null
          papel?: Database["public"]["Enums"]["obra_papel"]
          pessoa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_responsaveis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_responsaveis_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_timeline: {
        Row: {
          created_at: string
          detalhes: string | null
          empresa_id: string
          evento: string
          id: string
          obra_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhes?: string | null
          empresa_id?: string
          evento: string
          id?: string
          obra_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhes?: string | null
          empresa_id?: string
          evento?: string
          id?: string
          obra_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_timeline_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_timeline_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          codigo_chamado: string
          created_at: string
          created_by: string | null
          data_recebimento: string
          descricao_servico: string | null
          empresa_id: string
          endereco: string | null
          engenheiro_responsavel: string | null
          id: string
          origem: string
          regiao: Database["public"]["Enums"]["obra_regiao"] | null
          regiao_label: string | null
          status: Database["public"]["Enums"]["obra_status"]
          updated_at: string
        }
        Insert: {
          codigo_chamado: string
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          descricao_servico?: string | null
          empresa_id?: string
          endereco?: string | null
          engenheiro_responsavel?: string | null
          id?: string
          origem?: string
          regiao?: Database["public"]["Enums"]["obra_regiao"] | null
          regiao_label?: string | null
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
        }
        Update: {
          codigo_chamado?: string
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          descricao_servico?: string | null
          empresa_id?: string
          endereco?: string | null
          engenheiro_responsavel?: string | null
          id?: string
          origem?: string
          regiao?: Database["public"]["Enums"]["obra_regiao"] | null
          regiao_label?: string | null
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          aliquota_iss: number
          codigo: string | null
          created_at: string
          desconto_pct: number
          descricao: string
          descricao_detalhada: string | null
          empresa_id: string
          id: string
          orcamento_id: string
          ordem: number
          preco_unitario: number
          quantidade: number
          servico_id: string | null
          subtotal: number | null
          tipo: string
          unidade: string
        }
        Insert: {
          aliquota_iss?: number
          codigo?: string | null
          created_at?: string
          desconto_pct?: number
          descricao: string
          descricao_detalhada?: string | null
          empresa_id: string
          id?: string
          orcamento_id: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          servico_id?: string | null
          subtotal?: number | null
          tipo?: string
          unidade?: string
        }
        Update: {
          aliquota_iss?: number
          codigo?: string | null
          created_at?: string
          desconto_pct?: number
          descricao?: string
          descricao_detalhada?: string | null
          empresa_id?: string
          id?: string
          orcamento_id?: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          servico_id?: string | null
          subtotal?: number | null
          tipo?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          arquivo_path: string | null
          arquivo_url: string | null
          cliente_cnpj: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_inscricao_estadual: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          codigo_chamado: string | null
          comprador_id: string | null
          condicao_pagamento: string
          condicoes_pagamento: string | null
          created_at: string
          data_emissao: string | null
          data_envio: string | null
          data_orcamento: string
          data_resposta: string | null
          data_validade: string | null
          desconto_global_pct: number
          desconto_global_valor: number
          descricao: string | null
          empresa_id: string
          engenheiro_aprovador: string | null
          id: string
          intervalo_parcelas: number
          last_updated_at: string | null
          last_updated_by: string | null
          local_execucao: string | null
          numero: string | null
          numero_orcamento: string | null
          numero_parcelas: number
          objeto: string | null
          obra_id: string | null
          observacoes: string | null
          observacoes_internas: string | null
          percentual_entrada: number
          prazo_execucao: string | null
          status: Database["public"]["Enums"]["orcamento_status"]
          subtotal: number
          titulo: string | null
          updated_at: string
          validade_dias: number
          valor_impostos: number
          valor_orcamento: number
          valor_total: number
          vendedor_id: string | null
        }
        Insert: {
          arquivo_path?: string | null
          arquivo_url?: string | null
          cliente_cnpj?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_inscricao_estadual?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          codigo_chamado?: string | null
          comprador_id?: string | null
          condicao_pagamento?: string
          condicoes_pagamento?: string | null
          created_at?: string
          data_emissao?: string | null
          data_envio?: string | null
          data_orcamento?: string
          data_resposta?: string | null
          data_validade?: string | null
          desconto_global_pct?: number
          desconto_global_valor?: number
          descricao?: string | null
          empresa_id?: string
          engenheiro_aprovador?: string | null
          id?: string
          intervalo_parcelas?: number
          last_updated_at?: string | null
          last_updated_by?: string | null
          local_execucao?: string | null
          numero?: string | null
          numero_orcamento?: string | null
          numero_parcelas?: number
          objeto?: string | null
          obra_id?: string | null
          observacoes?: string | null
          observacoes_internas?: string | null
          percentual_entrada?: number
          prazo_execucao?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          subtotal?: number
          titulo?: string | null
          updated_at?: string
          validade_dias?: number
          valor_impostos?: number
          valor_orcamento?: number
          valor_total?: number
          vendedor_id?: string | null
        }
        Update: {
          arquivo_path?: string | null
          arquivo_url?: string | null
          cliente_cnpj?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_inscricao_estadual?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          codigo_chamado?: string | null
          comprador_id?: string | null
          condicao_pagamento?: string
          condicoes_pagamento?: string | null
          created_at?: string
          data_emissao?: string | null
          data_envio?: string | null
          data_orcamento?: string
          data_resposta?: string | null
          data_validade?: string | null
          desconto_global_pct?: number
          desconto_global_valor?: number
          descricao?: string | null
          empresa_id?: string
          engenheiro_aprovador?: string | null
          id?: string
          intervalo_parcelas?: number
          last_updated_at?: string | null
          last_updated_by?: string | null
          local_execucao?: string | null
          numero?: string | null
          numero_orcamento?: string | null
          numero_parcelas?: number
          objeto?: string | null
          obra_id?: string | null
          observacoes?: string | null
          observacoes_internas?: string | null
          percentual_entrada?: number
          prazo_execucao?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          subtotal?: number
          titulo?: string | null
          updated_at?: string
          validade_dias?: number
          valor_impostos?: number
          valor_orcamento?: number
          valor_total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "compradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      origens_obra: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "origens_obra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_pagamento: {
        Row: {
          comprovante_path: string | null
          comprovante_url: string | null
          contratacao_id: string
          created_at: string
          data_pagamento: string | null
          data_prevista: string | null
          empresa_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          numero_parcela: number
          observacao: string | null
          paid_by: string | null
          status: Database["public"]["Enums"]["parcela_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          comprovante_path?: string | null
          comprovante_url?: string | null
          contratacao_id: string
          created_at?: string
          data_pagamento?: string | null
          data_prevista?: string | null
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          numero_parcela: number
          observacao?: string | null
          paid_by?: string | null
          status?: Database["public"]["Enums"]["parcela_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          comprovante_path?: string | null
          comprovante_url?: string | null
          contratacao_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_prevista?: string | null
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          numero_parcela?: number
          observacao?: string | null
          paid_by?: string | null
          status?: Database["public"]["Enums"]["parcela_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_pagamento_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "contratacoes_terceirizado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          codigo_chamado_avulso: string | null
          comprador_id: string | null
          created_at: string
          data_recebimento: string | null
          empresa_id: string
          id: string
          numero_pedido: string | null
          obra_id: string | null
          status: Database["public"]["Enums"]["pc_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          codigo_chamado_avulso?: string | null
          comprador_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          empresa_id?: string
          id?: string
          numero_pedido?: string | null
          obra_id?: string | null
          status?: Database["public"]["Enums"]["pc_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          codigo_chamado_avulso?: string | null
          comprador_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          empresa_id?: string
          id?: string
          numero_pedido?: string | null
          obra_id?: string | null
          status?: Database["public"]["Enums"]["pc_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "compradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_permissoes: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          empresa_id: string
          id: string
          modulo: Database["public"]["Enums"]["app_modulo"]
          pessoa_id: string
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          modulo: Database["public"]["Enums"]["app_modulo"]
          pessoa_id: string
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          modulo?: Database["public"]["Enums"]["app_modulo"]
          pessoa_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_permissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_permissoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          agencia: string | null
          banco: string | null
          cargo: string | null
          chave_pix: string | null
          conta: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          data_admissao: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          status: Database["public"]["Enums"]["pessoa_status"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["pessoa_tipo"]
          tipo_servico: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          cargo?: string | null
          chave_pix?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pessoa_status"]
          telefone?: string | null
          tipo: Database["public"]["Enums"]["pessoa_tipo"]
          tipo_servico?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          cargo?: string | null
          chave_pix?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pessoa_status"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          tipo_servico?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          cakto_checkout_url_anual: string | null
          cakto_checkout_url_mensal: string | null
          cakto_product_id_anual: string | null
          cakto_product_id_mensal: string | null
          created_at: string
          descricao: string | null
          destaque: boolean
          id: string
          limite_obras: number | null
          limite_usuarios: number | null
          nome: string
          ordem: number
          paddle_price_id_anual: string | null
          paddle_price_id_mensal: string | null
          preco_anual: number
          preco_mensal: number
          recursos: Json
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cakto_checkout_url_anual?: string | null
          cakto_checkout_url_mensal?: string | null
          cakto_product_id_anual?: string | null
          cakto_product_id_mensal?: string | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          limite_obras?: number | null
          limite_usuarios?: number | null
          nome: string
          ordem?: number
          paddle_price_id_anual?: string | null
          paddle_price_id_mensal?: string | null
          preco_anual?: number
          preco_mensal?: number
          recursos?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cakto_checkout_url_anual?: string | null
          cakto_checkout_url_mensal?: string | null
          cakto_product_id_anual?: string | null
          cakto_product_id_mensal?: string | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          limite_obras?: number | null
          limite_usuarios?: number | null
          nome?: string
          ordem?: number
          paddle_price_id_anual?: string | null
          paddle_price_id_mensal?: string | null
          preco_anual?: number
          preco_mensal?: number
          recursos?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rcs: {
        Row: {
          codigo_chamado_avulso: string | null
          created_at: string
          data_rc: string | null
          empresa_id: string
          id: string
          numero_rc: string | null
          obra_id: string | null
          status: Database["public"]["Enums"]["rc_status"]
          updated_at: string
        }
        Insert: {
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_rc?: string | null
          empresa_id?: string
          id?: string
          numero_rc?: string | null
          obra_id?: string | null
          status?: Database["public"]["Enums"]["rc_status"]
          updated_at?: string
        }
        Update: {
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_rc?: string | null
          empresa_id?: string
          id?: string
          numero_rc?: string | null
          obra_id?: string | null
          status?: Database["public"]["Enums"]["rc_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rcs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rcs_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          created_at: string
          data_prevista: string | null
          data_recebido: string | null
          empresa_id: string
          id: string
          obra_id: string
          pedido_compra_id: string | null
          status: Database["public"]["Enums"]["recebimento_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_prevista?: string | null
          data_recebido?: string | null
          empresa_id?: string
          id?: string
          obra_id: string
          pedido_compra_id?: string | null
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data_prevista?: string | null
          data_recebido?: string | null
          empresa_id?: string
          id?: string
          obra_id?: string
          pedido_compra_id?: string | null
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      regioes_obra: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "regioes_obra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          aliquota_iss: number
          ativo: boolean
          categoria_id: string | null
          codigo: string | null
          codigo_lc116: string | null
          codigo_nbs: string | null
          codigo_servico_municipio: string | null
          created_at: string
          desconto_padrao_pct: number
          descricao: string | null
          descricao_detalhada: string | null
          empresa_id: string
          id: string
          iss_retido: boolean
          nome: string
          preco_unitario: number
          tipo_tributacao: string
          unidade: string
          updated_at: string
        }
        Insert: {
          aliquota_iss?: number
          ativo?: boolean
          categoria_id?: string | null
          codigo?: string | null
          codigo_lc116?: string | null
          codigo_nbs?: string | null
          codigo_servico_municipio?: string | null
          created_at?: string
          desconto_padrao_pct?: number
          descricao?: string | null
          descricao_detalhada?: string | null
          empresa_id: string
          id?: string
          iss_retido?: boolean
          nome: string
          preco_unitario?: number
          tipo_tributacao?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          aliquota_iss?: number
          ativo?: boolean
          categoria_id?: string | null
          codigo?: string | null
          codigo_lc116?: string | null
          codigo_nbs?: string | null
          codigo_servico_municipio?: string | null
          created_at?: string
          desconto_padrao_pct?: number
          descricao?: string | null
          descricao_detalhada?: string | null
          empresa_id?: string
          id?: string
          iss_retido?: boolean
          nome?: string
          preco_unitario?: number
          tipo_tributacao?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vistorias: {
        Row: {
          created_at: string
          data_vistoria: string
          empresa_id: string
          id: string
          obra_id: string
          observacoes: string | null
          responsavel_vistoria: string
          status: Database["public"]["Enums"]["vistoria_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_vistoria: string
          empresa_id?: string
          id?: string
          obra_id: string
          observacoes?: string | null
          responsavel_vistoria: string
          status?: Database["public"]["Enums"]["vistoria_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_vistoria?: string
          empresa_id?: string
          id?: string
          obra_id?: string
          observacoes?: string | null
          responsavel_vistoria?: string
          status?: Database["public"]["Enums"]["vistoria_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_empresas_contatos: {
        Args: never
        Returns: {
          admin_email: string
          admin_nome: string
          admin_telefone: string
          empresa_id: string
        }[]
      }
      can_access_obra: {
        Args: { _obra_id: string; _uid: string }
        Returns: boolean
      }
      criar_obra_segura: {
        Args: {
          _codigo_chamado: string
          _data_recebimento: string
          _descricao_servico: string
          _endereco: string
          _engenheiro_responsavel: string
          _origem: string
          _regiao_label: string
        }
        Returns: {
          codigo_chamado: string
          created_at: string
          created_by: string | null
          data_recebimento: string
          descricao_servico: string | null
          empresa_id: string
          endereco: string | null
          engenheiro_responsavel: string | null
          id: string
          origem: string
          regiao: Database["public"]["Enums"]["obra_regiao"] | null
          regiao_label: string | null
          status: Database["public"]["Enums"]["obra_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "obras"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      empresa_assinatura_ativa: {
        Args: { _empresa_id: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_obra_for_chamado: {
        Args: { _chamado: string; _descricao: string; _endereco: string }
        Returns: string
      }
      get_dre_obra: {
        Args: { _empresa_id: string; _obra_id?: string }
        Returns: {
          custo_materiais: number
          custo_subcontratado: number
          custo_total_real: number
          margem_bruta: number
          margem_pct: number
          obra_codigo: string
          obra_id: string
          receita_contratada: number
          receita_medida: number
          receita_recebida: number
        }[]
      }
      get_fluxo_caixa_mensal: {
        Args: {
          _empresa_id: string
          _meses_atras?: number
          _meses_frente?: number
        }
        Returns: {
          ano: number
          despesas_prev: number
          despesas_real: number
          mes: string
          mes_num: number
          receitas_prev: number
          receitas_real: number
          saldo_acumulado: number
          saldo_prev: number
          saldo_real: number
        }[]
      }
      get_obra_financeiro_resumo: {
        Args: { _obra_id?: string }
        Returns: {
          codigo_chamado: string
          custo_cartao: number
          custo_materiais: number
          custo_terceirizados_pago: number
          custo_terceirizados_previsto: number
          custo_total: number
          despesas_realizadas: number
          obra_id: string
          receita_faturada: number
          receita_orcada: number
          receita_recebida: number
          saldo: number
        }[]
      }
      get_user_empresa_id: { Args: never; Returns: string }
      has_permission: {
        Args: {
          _acao: Database["public"]["Enums"]["app_acao"]
          _modulo: Database["public"]["Enums"]["app_modulo"]
          _uid: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      seed_categorias_financeiras: {
        Args: { _empresa_id: string }
        Returns: undefined
      }
      signup_create_company: {
        Args: { _nome_empresa: string }
        Returns: string
      }
      tenant_match: { Args: { _empresa_id: string }; Returns: boolean }
    }
    Enums: {
      app_acao: "view" | "create" | "edit" | "delete"
      app_modulo:
        | "dashboard"
        | "obras"
        | "financeiro"
        | "faturamento"
        | "equipes"
        | "vistorias"
        | "orcamentos"
        | "execucoes"
        | "etapas"
        | "servicos"
        | "cartoes"
        | "compradores"
      app_role:
        | "admin"
        | "gestor"
        | "engenheiro"
        | "financeiro"
        | "operacional"
        | "super_admin"
      assinatura_periodo: "mensal" | "anual"
      assinatura_status:
        | "trialing"
        | "active"
        | "past_due"
        | "paused"
        | "canceled"
        | "expired"
      categoria_grupo:
        | "receita_servico"
        | "receita_material"
        | "receita_outro"
        | "custo_mao_obra_direta"
        | "custo_mao_obra_indireta"
        | "custo_material"
        | "custo_equipamento"
        | "custo_subcontratado"
        | "custo_administrativo"
        | "custo_imposto"
        | "custo_outro"
      contratacao_status:
        | "pendente"
        | "parcialmente_pago"
        | "pago"
        | "cancelado"
      contrato_cliente_status:
        | "ativo"
        | "suspenso"
        | "encerrado"
        | "em_negociacao"
      diario_status: "enviado" | "aprovado" | "reprovado"
      execucao_status: "nao_iniciada" | "em_execucao" | "pausada" | "finalizada"
      execucao_tipo: "equipe_propria" | "terceirizado"
      forma_pagamento: "pix" | "dinheiro" | "transferencia" | "boleto" | "outro"
      foto_tipo: "antes" | "durante" | "depois"
      lancamento_status: "previsto" | "realizado" | "cancelado"
      lancamento_tipo: "receita" | "despesa"
      medicao_status: "rascunho" | "enviada" | "aprovada" | "rejeitada"
      obra_origem: "veman" | "sabesp"
      obra_papel:
        | "responsavel_administrativo"
        | "executor_operacional"
        | "terceirizado"
      obra_regiao: "leste" | "oeste" | "norte" | "sul" | "interior"
      obra_status:
        | "recebido"
        | "em_vistoria"
        | "aguardando_orcamento"
        | "em_aprovacao"
        | "aprovado"
        | "em_execucao"
        | "finalizado"
        | "aguardando_rc"
        | "aguardando_pedido_compra"
        | "aguardando_nf"
        | "aguardando_pagamento"
        | "pago"
      orcamento_status:
        | "em_elaboracao"
        | "enviado"
        | "em_negociacao"
        | "aprovado"
        | "reprovado"
        | "cancelado"
      parcela_status: "pendente" | "pago"
      pc_status: "aguardando" | "recebido"
      pessoa_status: "ativo" | "inativo"
      pessoa_tipo: "terceirizado" | "administrativo" | "operacional"
      rc_status: "aguardando" | "recebido"
      recebimento_status: "a_receber" | "recebido"
      vistoria_status: "pendente" | "vistoriado"
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
      app_acao: ["view", "create", "edit", "delete"],
      app_modulo: [
        "dashboard",
        "obras",
        "financeiro",
        "faturamento",
        "equipes",
        "vistorias",
        "orcamentos",
        "execucoes",
        "etapas",
        "servicos",
        "cartoes",
        "compradores",
      ],
      app_role: [
        "admin",
        "gestor",
        "engenheiro",
        "financeiro",
        "operacional",
        "super_admin",
      ],
      assinatura_periodo: ["mensal", "anual"],
      assinatura_status: [
        "trialing",
        "active",
        "past_due",
        "paused",
        "canceled",
        "expired",
      ],
      categoria_grupo: [
        "receita_servico",
        "receita_material",
        "receita_outro",
        "custo_mao_obra_direta",
        "custo_mao_obra_indireta",
        "custo_material",
        "custo_equipamento",
        "custo_subcontratado",
        "custo_administrativo",
        "custo_imposto",
        "custo_outro",
      ],
      contratacao_status: [
        "pendente",
        "parcialmente_pago",
        "pago",
        "cancelado",
      ],
      contrato_cliente_status: [
        "ativo",
        "suspenso",
        "encerrado",
        "em_negociacao",
      ],
      diario_status: ["enviado", "aprovado", "reprovado"],
      execucao_status: ["nao_iniciada", "em_execucao", "pausada", "finalizada"],
      execucao_tipo: ["equipe_propria", "terceirizado"],
      forma_pagamento: ["pix", "dinheiro", "transferencia", "boleto", "outro"],
      foto_tipo: ["antes", "durante", "depois"],
      lancamento_status: ["previsto", "realizado", "cancelado"],
      lancamento_tipo: ["receita", "despesa"],
      medicao_status: ["rascunho", "enviada", "aprovada", "rejeitada"],
      obra_origem: ["veman", "sabesp"],
      obra_papel: [
        "responsavel_administrativo",
        "executor_operacional",
        "terceirizado",
      ],
      obra_regiao: ["leste", "oeste", "norte", "sul", "interior"],
      obra_status: [
        "recebido",
        "em_vistoria",
        "aguardando_orcamento",
        "em_aprovacao",
        "aprovado",
        "em_execucao",
        "finalizado",
        "aguardando_rc",
        "aguardando_pedido_compra",
        "aguardando_nf",
        "aguardando_pagamento",
        "pago",
      ],
      orcamento_status: [
        "em_elaboracao",
        "enviado",
        "em_negociacao",
        "aprovado",
        "reprovado",
        "cancelado",
      ],
      parcela_status: ["pendente", "pago"],
      pc_status: ["aguardando", "recebido"],
      pessoa_status: ["ativo", "inativo"],
      pessoa_tipo: ["terceirizado", "administrativo", "operacional"],
      rc_status: ["aguardando", "recebido"],
      recebimento_status: ["a_receber", "recebido"],
      vistoria_status: ["pendente", "vistoriado"],
    },
  },
} as const
