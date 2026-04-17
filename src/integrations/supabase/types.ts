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
      contratacoes_terceirizado: {
        Row: {
          created_at: string
          created_by: string | null
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
      diario_obra: {
        Row: {
          created_at: string
          data_envio: string
          id: string
          obra_id: string
          observacoes: string
          status: Database["public"]["Enums"]["diario_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_envio?: string
          id?: string
          obra_id: string
          observacoes: string
          status?: Database["public"]["Enums"]["diario_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_envio?: string
          id?: string
          obra_id?: string
          observacoes?: string
          status?: Database["public"]["Enums"]["diario_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diario_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      execucoes: {
        Row: {
          created_at: string
          data_inicio: string | null
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
            foreignKeyName: "fotos_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_obra: {
        Row: {
          anexo_path: string | null
          anexo_url: string | null
          created_at: string
          created_by: string | null
          data_compra: string
          descricao: string
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
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao: string
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
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao?: string
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
            foreignKeyName: "materiais_obra_obra_id_fkey"
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
          id: string
          numero_nf: string
          obra_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          arquivo_pdf_url?: string | null
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_emissao: string
          id?: string
          numero_nf: string
          obra_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          arquivo_pdf_url?: string | null
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_emissao?: string
          id?: string
          numero_nf?: string
          obra_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_responsaveis: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          obra_id: string
          observacao: string | null
          papel: Database["public"]["Enums"]["obra_papel"]
          pessoa_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          obra_id: string
          observacao?: string | null
          papel: Database["public"]["Enums"]["obra_papel"]
          pessoa_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          obra_id?: string
          observacao?: string | null
          papel?: Database["public"]["Enums"]["obra_papel"]
          pessoa_id?: string
        }
        Relationships: [
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
          evento: string
          id: string
          obra_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhes?: string | null
          evento: string
          id?: string
          obra_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhes?: string | null
          evento?: string
          id?: string
          obra_id?: string
          user_id?: string | null
        }
        Relationships: [
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
          descricao_servico: string
          endereco: string
          engenheiro_responsavel: string
          id: string
          origem: Database["public"]["Enums"]["obra_origem"]
          regiao: Database["public"]["Enums"]["obra_regiao"]
          status: Database["public"]["Enums"]["obra_status"]
          updated_at: string
        }
        Insert: {
          codigo_chamado: string
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          descricao_servico: string
          endereco: string
          engenheiro_responsavel: string
          id?: string
          origem?: Database["public"]["Enums"]["obra_origem"]
          regiao: Database["public"]["Enums"]["obra_regiao"]
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
        }
        Update: {
          codigo_chamado?: string
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          descricao_servico?: string
          endereco?: string
          engenheiro_responsavel?: string
          id?: string
          origem?: Database["public"]["Enums"]["obra_origem"]
          regiao?: Database["public"]["Enums"]["obra_regiao"]
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          arquivo_path: string | null
          arquivo_url: string | null
          created_at: string
          data_envio: string | null
          descricao: string | null
          engenheiro_aprovador: string | null
          id: string
          last_updated_at: string | null
          last_updated_by: string | null
          numero_orcamento: string | null
          obra_id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["orcamento_status"]
          updated_at: string
          valor_orcamento: number
        }
        Insert: {
          arquivo_path?: string | null
          arquivo_url?: string | null
          created_at?: string
          data_envio?: string | null
          descricao?: string | null
          engenheiro_aprovador?: string | null
          id?: string
          last_updated_at?: string | null
          last_updated_by?: string | null
          numero_orcamento?: string | null
          obra_id: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          updated_at?: string
          valor_orcamento?: number
        }
        Update: {
          arquivo_path?: string | null
          arquivo_url?: string | null
          created_at?: string
          data_envio?: string | null
          descricao?: string | null
          engenheiro_aprovador?: string | null
          id?: string
          last_updated_at?: string | null
          last_updated_by?: string | null
          numero_orcamento?: string | null
          obra_id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          updated_at?: string
          valor_orcamento?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
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
        ]
      }
      pedidos_compra: {
        Row: {
          codigo_chamado_avulso: string | null
          created_at: string
          data_recebimento: string | null
          id: string
          numero_pedido: string | null
          obra_id: string | null
          status: Database["public"]["Enums"]["pc_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_recebimento?: string | null
          id?: string
          numero_pedido?: string | null
          obra_id?: string | null
          status?: Database["public"]["Enums"]["pc_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_recebimento?: string | null
          id?: string
          numero_pedido?: string | null
          obra_id?: string | null
          status?: Database["public"]["Enums"]["pc_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
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
          id?: string
          numero_rc?: string | null
          obra_id?: string | null
          status?: Database["public"]["Enums"]["rc_status"]
          updated_at?: string
        }
        Relationships: [
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
          id: string
          obra_id: string
          status: Database["public"]["Enums"]["recebimento_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_prevista?: string | null
          data_recebido?: string | null
          id?: string
          obra_id: string
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data_prevista?: string | null
          data_recebido?: string | null
          id?: string
          obra_id?: string
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
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
      vistorias: {
        Row: {
          created_at: string
          data_vistoria: string
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
          id?: string
          obra_id?: string
          observacoes?: string | null
          responsavel_vistoria?: string
          status?: Database["public"]["Enums"]["vistoria_status"]
          updated_at?: string
        }
        Relationships: [
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
      can_access_obra: {
        Args: { _obra_id: string; _uid: string }
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
    }
    Enums: {
      app_role:
        | "admin"
        | "gestor"
        | "engenheiro"
        | "financeiro"
        | "operacional"
        | "super_admin"
      contratacao_status:
        | "pendente"
        | "parcialmente_pago"
        | "pago"
        | "cancelado"
      diario_status: "enviado" | "aprovado" | "reprovado"
      execucao_status: "nao_iniciada" | "em_execucao" | "pausada" | "finalizada"
      execucao_tipo: "equipe_propria" | "terceirizado"
      forma_pagamento: "pix" | "dinheiro" | "transferencia" | "boleto" | "outro"
      foto_tipo: "antes" | "durante" | "depois"
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
      app_role: [
        "admin",
        "gestor",
        "engenheiro",
        "financeiro",
        "operacional",
        "super_admin",
      ],
      contratacao_status: [
        "pendente",
        "parcialmente_pago",
        "pago",
        "cancelado",
      ],
      diario_status: ["enviado", "aprovado", "reprovado"],
      execucao_status: ["nao_iniciada", "em_execucao", "pausada", "finalizada"],
      execucao_tipo: ["equipe_propria", "terceirizado"],
      forma_pagamento: ["pix", "dinheiro", "transferencia", "boleto", "outro"],
      foto_tipo: ["antes", "durante", "depois"],
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
