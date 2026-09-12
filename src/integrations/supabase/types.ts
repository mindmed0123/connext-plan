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
      alcadas: {
        Row: {
          ativo: boolean
          created_at: string
          documento: string
          empresa_id: string
          id: string
          ordem: number
          perfil_id: string | null
          pessoa_id: string | null
          updated_at: string
          valor_ate: number | null
          valor_de: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          documento: string
          empresa_id?: string
          id?: string
          ordem?: number
          perfil_id?: string | null
          pessoa_id?: string | null
          updated_at?: string
          valor_ate?: number | null
          valor_de?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          documento?: string
          empresa_id?: string
          id?: string
          ordem?: number
          perfil_id?: string | null
          pessoa_id?: string | null
          updated_at?: string
          valor_ate?: number | null
          valor_de?: number
        }
        Relationships: [
          {
            foreignKeyName: "alcadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alcadas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_permissao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alcadas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      aprovacoes: {
        Row: {
          alcada_id: string | null
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          descricao: string | null
          documento: string
          empresa_id: string
          id: string
          justificativa: string | null
          ordem: number
          perfil_id: string | null
          pessoa_id: string | null
          registro_id: string
          solicitado_por: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          alcada_id?: string | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          descricao?: string | null
          documento: string
          empresa_id?: string
          id?: string
          justificativa?: string | null
          ordem?: number
          perfil_id?: string | null
          pessoa_id?: string | null
          registro_id: string
          solicitado_por?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          alcada_id?: string | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          descricao?: string | null
          documento?: string
          empresa_id?: string
          id?: string
          justificativa?: string | null
          ordem?: number
          perfil_id?: string | null
          pessoa_id?: string | null
          registro_id?: string
          solicitado_por?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_alcada_id_fkey"
            columns: ["alcada_id"]
            isOneToOne: false
            referencedRelation: "alcadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_permissao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
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
      audit_log: {
        Row: {
          acao: string
          ator_email: string | null
          ator_user_id: string | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          empresa_id: string | null
          id: string
          ip: string | null
          justificativa: string | null
          papel: string | null
          registro_id: string | null
          suporte: boolean
          tabela: string
        }
        Insert: {
          acao: string
          ator_email?: string | null
          ator_user_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          empresa_id?: string | null
          id?: string
          ip?: string | null
          justificativa?: string | null
          papel?: string | null
          registro_id?: string | null
          suporte?: boolean
          tabela: string
        }
        Update: {
          acao?: string
          ator_email?: string | null
          ator_user_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          empresa_id?: string | null
          id?: string
          ip?: string | null
          justificativa?: string | null
          papel?: string | null
          registro_id?: string | null
          suporte?: boolean
          tabela?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          centro_custo_id: string | null
          competencia_fatura: string | null
          comprador_id: string | null
          created_at: string
          created_by: string | null
          data_compra: string
          descricao: string
          empresa_id: string
          etapa_id: string | null
          fatura_paga: boolean
          fatura_paga_em: string | null
          fatura_vencimento: string | null
          grupo_parcelamento: string | null
          id: string
          obra_id: string | null
          observacoes: string | null
          orcamento_item_id: string | null
          parcela_num: number | null
          parcelas: number
          total_parcelas: number | null
          updated_at: string
          valor: number
        }
        Insert: {
          cartao_id: string
          categoria?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          competencia_fatura?: string | null
          comprador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao: string
          empresa_id?: string
          etapa_id?: string | null
          fatura_paga?: boolean
          fatura_paga_em?: string | null
          fatura_vencimento?: string | null
          grupo_parcelamento?: string | null
          id?: string
          obra_id?: string | null
          observacoes?: string | null
          orcamento_item_id?: string | null
          parcela_num?: number | null
          parcelas?: number
          total_parcelas?: number | null
          updated_at?: string
          valor?: number
        }
        Update: {
          cartao_id?: string
          categoria?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          competencia_fatura?: string | null
          comprador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao?: string
          empresa_id?: string
          etapa_id?: string | null
          fatura_paga?: boolean
          fatura_paga_em?: string | null
          fatura_vencimento?: string | null
          grupo_parcelamento?: string | null
          id?: string
          obra_id?: string | null
          observacoes?: string | null
          orcamento_item_id?: string | null
          parcela_num?: number | null
          parcelas?: number
          total_parcelas?: number | null
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
            foreignKeyName: "cartao_despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartao_despesas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
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
            foreignKeyName: "cartao_despesas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartao_despesas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartao_despesas_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
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
        Relationships: [
          {
            foreignKeyName: "cartoes_credito_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria_grupos: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
          papel: string | null
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome: string
          ordem?: number
          papel?: string | null
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          papel?: string | null
          tipo?: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categoria_grupos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          empresa_id: string
          grupo: Database["public"]["Enums"]["categoria_grupo"]
          grupo_id: string | null
          id: string
          nome: string
          ordem: number
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          empresa_id: string
          grupo: Database["public"]["Enums"]["categoria_grupo"]
          grupo_id?: string | null
          id?: string
          nome: string
          ordem?: number
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          empresa_id?: string
          grupo?: Database["public"]["Enums"]["categoria_grupo"]
          grupo_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["lancamento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_financeiras_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "categoria_grupos"
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
      centros_custo: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_intents: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          periodo: string
          plano_id: string
          usado_em: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          periodo: string
          plano_id: string
          usado_em?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          periodo?: string
          plano_id?: string
          usado_em?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_intents_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_intents_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          aliquota_iss: number
          cnpj: string
          created_at: string
          email: string | null
          empresa_id: string
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          municipio: string | null
          nome: string
          prazo_pagamento_dias: number
          retem_csrf: boolean
          retem_inss: boolean
          retem_irrf: boolean
          retem_iss: boolean
          telefone: string | null
          updated_at: string
        }
        Insert: {
          aliquota_iss?: number
          cnpj: string
          created_at?: string
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          municipio?: string | null
          nome: string
          prazo_pagamento_dias?: number
          retem_csrf?: boolean
          retem_inss?: boolean
          retem_irrf?: boolean
          retem_iss?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_iss?: number
          cnpj?: string
          created_at?: string
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          municipio?: string | null
          nome?: string
          prazo_pagamento_dias?: number
          retem_csrf?: boolean
          retem_inss?: boolean
          retem_irrf?: boolean
          retem_iss?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      comprador_contratos: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          comprador_id: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          id: string
          numero_contrato: string | null
          objeto: string
          observacoes: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          comprador_id: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          id?: string
          numero_contrato?: string | null
          objeto: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          comprador_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          id?: string
          numero_contrato?: string | null
          objeto?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comprador_contratos_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "compradores"
            referencedColumns: ["id"]
          },
        ]
      }
      compradores: {
        Row: {
          ativo: boolean
          bairro: string | null
          cargo: string | null
          cep: string | null
          cidade: string | null
          condicoes_comerciais: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          observacoes: string | null
          razao_social: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          site: string | null
          telefone: string | null
          tipo_instituicao: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          condicoes_comerciais?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome: string
          observacoes?: string | null
          razao_social?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          site?: string | null
          telefone?: string | null
          tipo_instituicao?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          condicoes_comerciais?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome?: string
          observacoes?: string | null
          razao_social?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          site?: string | null
          telefone?: string | null
          tipo_instituicao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          conta: string | null
          created_at: string
          data_saldo_inicial: string | null
          empresa_id: string
          id: string
          nome: string
          saldo_inicial: number
          tipo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          data_saldo_inicial?: string | null
          empresa_id?: string
          id?: string
          nome: string
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          data_saldo_inicial?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar: {
        Row: {
          categoria_id: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          descricao: string
          empresa_id: string
          etapa_id: string | null
          fornecedor_id: string | null
          id: string
          numero_documento: string | null
          obra_id: string | null
          observacoes: string | null
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          descricao: string
          empresa_id?: string
          etapa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_documento?: string | null
          obra_id?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          descricao?: string
          empresa_id?: string
          etapa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_documento?: string | null
          obra_id?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_parcelas: {
        Row: {
          comprovante_url: string | null
          conta_bancaria_id: string | null
          conta_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          empresa_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          numero: number
          status: string
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          conta_id: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          numero?: number
          status?: string
          updated_at?: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          conta_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          numero?: number
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_parcelas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_parcelas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_parcelas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contratacoes_terceirizado: {
        Row: {
          centro_custo_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          etapa_id: string | null
          forma_pagamento_prevista:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id: string
          obra_id: string
          observacoes: string | null
          orcamento_item_id: string | null
          quantidade_parcelas: number
          status_financeiro: Database["public"]["Enums"]["contratacao_status"]
          terceirizado_id: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          centro_custo_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          etapa_id?: string | null
          forma_pagamento_prevista?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          obra_id: string
          observacoes?: string | null
          orcamento_item_id?: string | null
          quantidade_parcelas?: number
          status_financeiro?: Database["public"]["Enums"]["contratacao_status"]
          terceirizado_id: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          centro_custo_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          etapa_id?: string | null
          forma_pagamento_prevista?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          obra_id?: string
          observacoes?: string | null
          orcamento_item_id?: string | null
          quantidade_parcelas?: number
          status_financeiro?: Database["public"]["Enums"]["contratacao_status"]
          terceirizado_id?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratacoes_terceirizado_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_terceirizado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_terceirizado_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
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
            foreignKeyName: "contratacoes_terceirizado_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
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
          prazo_pagamento_dias: number | null
          retencao_contratual_pct: number
          retencao_devolucao_prevista: string | null
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
          empresa_id?: string
          id?: string
          numero_contrato?: string | null
          objeto: string
          obra_id?: string | null
          observacoes?: string | null
          prazo_pagamento_dias?: number | null
          retencao_contratual_pct?: number
          retencao_devolucao_prevista?: string | null
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
          prazo_pagamento_dias?: number | null
          retencao_contratual_pct?: number
          retencao_devolucao_prevista?: string | null
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
      cotacao_itens: {
        Row: {
          cotacao_id: string
          created_at: string
          disponivel: boolean
          empresa_id: string
          id: string
          marca: string | null
          prazo: string | null
          preco_unitario: number
          solicitacao_item_id: string
          updated_at: string
        }
        Insert: {
          cotacao_id: string
          created_at?: string
          disponivel?: boolean
          empresa_id?: string
          id?: string
          marca?: string | null
          prazo?: string | null
          preco_unitario?: number
          solicitacao_item_id: string
          updated_at?: string
        }
        Update: {
          cotacao_id?: string
          created_at?: string
          disponivel?: boolean
          empresa_id?: string
          id?: string
          marca?: string | null
          prazo?: string | null
          preco_unitario?: number
          solicitacao_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_solicitacao_item_id_fkey"
            columns: ["solicitacao_item_id"]
            isOneToOne: false
            referencedRelation: "solicitacao_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          condicao_pagamento: string | null
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string
          fornecedor_id: string
          frete: number
          id: string
          observacoes: string | null
          prazo_entrega: string | null
          solicitacao_id: string
          status: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          fornecedor_id: string
          frete?: number
          id?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          solicitacao_id: string
          status?: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          fornecedor_id?: string
          frete?: number
          id?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          solicitacao_id?: string
          status?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_etapas: {
        Row: {
          created_at: string
          empresa_id: string
          etapa_id: string | null
          id: string
          mes: string
          obra_id: string
          percentual_previsto: number
          updated_at: string
          valor_previsto: number
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          etapa_id?: string | null
          id?: string
          mes: string
          obra_id: string
          percentual_previsto?: number
          updated_at?: string
          valor_previsto?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string
          etapa_id?: string | null
          id?: string
          mes?: string
          obra_id?: string
          percentual_previsto?: number
          updated_at?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_etapas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_etapas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_obra: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          atividades_executadas: string | null
          clima_manha: string | null
          clima_tarde: string | null
          condicao_trabalho: string
          created_at: string
          data_envio: string
          efetivo: Json
          empresa_id: string
          equipamentos: Json
          id: string
          obra_id: string
          observacoes: string | null
          ocorrencias: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["diario_status"]
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atividades_executadas?: string | null
          clima_manha?: string | null
          clima_tarde?: string | null
          condicao_trabalho?: string
          created_at?: string
          data_envio?: string
          efetivo?: Json
          empresa_id?: string
          equipamentos?: Json
          id?: string
          obra_id: string
          observacoes?: string | null
          ocorrencias?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["diario_status"]
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atividades_executadas?: string | null
          clima_manha?: string | null
          clima_tarde?: string | null
          condicao_trabalho?: string
          created_at?: string
          data_envio?: string
          efetivo?: Json
          empresa_id?: string
          equipamentos?: Json
          id?: string
          obra_id?: string
          observacoes?: string | null
          ocorrencias?: string | null
          responsavel_id?: string | null
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
          {
            foreignKeyName: "diario_obra_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_contadores: {
        Row: {
          ano: number
          created_at: string
          empresa_id: string
          id: string
          tipo: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          empresa_id?: string
          id?: string
          tipo: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          empresa_id?: string
          id?: string
          tipo?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_contadores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      empresa_config: {
        Row: {
          aliquota_inss_cprb: number
          aliquota_inss_padrao: number
          aliquota_irrf_padrao: number
          aliquota_iss_padrao: number
          aliquota_pcc_padrao: number
          bdi_ac: number
          bdi_df: number
          bdi_i: number
          bdi_l: number
          bdi_r: number
          bdi_s: number
          cor_primaria: string
          cprb: boolean
          created_at: string
          email_remetente_endereco: string | null
          email_remetente_nome: string | null
          empresa_id: string
          mascara_contrato: string
          mascara_medicao: string
          mascara_nf: string
          mascara_orcamento: string
          perfil_operacao: Database["public"]["Enums"]["perfil_operacao"] | null
          prazo_pagamento_padrao: number
          regime_tributario:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          texto_condicoes: string | null
          texto_observacoes: string | null
          texto_rodape: string | null
          updated_at: string
          validade_orcamento_dias: number
        }
        Insert: {
          aliquota_inss_cprb?: number
          aliquota_inss_padrao?: number
          aliquota_irrf_padrao?: number
          aliquota_iss_padrao?: number
          aliquota_pcc_padrao?: number
          bdi_ac?: number
          bdi_df?: number
          bdi_i?: number
          bdi_l?: number
          bdi_r?: number
          bdi_s?: number
          cor_primaria?: string
          cprb?: boolean
          created_at?: string
          email_remetente_endereco?: string | null
          email_remetente_nome?: string | null
          empresa_id?: string
          mascara_contrato?: string
          mascara_medicao?: string
          mascara_nf?: string
          mascara_orcamento?: string
          perfil_operacao?:
            | Database["public"]["Enums"]["perfil_operacao"]
            | null
          prazo_pagamento_padrao?: number
          regime_tributario?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          texto_condicoes?: string | null
          texto_observacoes?: string | null
          texto_rodape?: string | null
          updated_at?: string
          validade_orcamento_dias?: number
        }
        Update: {
          aliquota_inss_cprb?: number
          aliquota_inss_padrao?: number
          aliquota_irrf_padrao?: number
          aliquota_iss_padrao?: number
          aliquota_pcc_padrao?: number
          bdi_ac?: number
          bdi_df?: number
          bdi_i?: number
          bdi_l?: number
          bdi_r?: number
          bdi_s?: number
          cor_primaria?: string
          cprb?: boolean
          created_at?: string
          email_remetente_endereco?: string | null
          email_remetente_nome?: string | null
          empresa_id?: string
          mascara_contrato?: string
          mascara_medicao?: string
          mascara_nf?: string
          mascara_orcamento?: string
          perfil_operacao?:
            | Database["public"]["Enums"]["perfil_operacao"]
            | null
          prazo_pagamento_padrao?: number
          regime_tributario?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          texto_condicoes?: string | null
          texto_observacoes?: string | null
          texto_rodape?: string | null
          updated_at?: string
          validade_orcamento_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresa_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
      empresa_modulos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          modulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          modulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          modulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_rotulos: {
        Row: {
          cliente: string
          codigo_obra: string
          comprador: string
          created_at: string
          empresa_id: string
          medicao: string
          obra_plural: string
          obra_singular: string
          orcamento: string
          updated_at: string
          usa_codigo_obra: boolean
          usa_comprador: boolean
          usa_engenheiro: boolean
          usa_regiao: boolean
        }
        Insert: {
          cliente?: string
          codigo_obra?: string
          comprador?: string
          created_at?: string
          empresa_id?: string
          medicao?: string
          obra_plural?: string
          obra_singular?: string
          orcamento?: string
          updated_at?: string
          usa_codigo_obra?: boolean
          usa_comprador?: boolean
          usa_engenheiro?: boolean
          usa_regiao?: boolean
        }
        Update: {
          cliente?: string
          codigo_obra?: string
          comprador?: string
          created_at?: string
          empresa_id?: string
          medicao?: string
          obra_plural?: string
          obra_singular?: string
          orcamento?: string
          updated_at?: string
          usa_codigo_obra?: boolean
          usa_comprador?: boolean
          usa_engenheiro?: boolean
          usa_regiao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "empresa_rotulos_empresa_id_fkey"
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
          cprb: boolean
          created_at: string
          data_saldo_inicial: string | null
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          nome: string
          onboarding_completo: boolean
          plano: string
          regime_tributario:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          saldo_inicial: number
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
          cprb?: boolean
          created_at?: string
          data_saldo_inicial?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome: string
          onboarding_completo?: boolean
          plano?: string
          regime_tributario?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          saldo_inicial?: number
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
          cprb?: boolean
          created_at?: string
          data_saldo_inicial?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome?: string
          onboarding_completo?: boolean
          plano?: string
          regime_tributario?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          saldo_inicial?: number
          slug?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exclusao_solicitacoes: {
        Row: {
          cancelada_em: string | null
          concluida_em: string | null
          confirmacao: string
          created_at: string
          empresa_id: string
          id: string
          motivo: string | null
          prazo_em: string
          solicitado_por: string
          solicitado_por_email: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancelada_em?: string | null
          concluida_em?: string | null
          confirmacao: string
          created_at?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          prazo_em?: string
          solicitado_por?: string
          solicitado_por_email?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancelada_em?: string | null
          concluida_em?: string | null
          confirmacao?: string
          created_at?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          prazo_em?: string
          solicitado_por?: string
          solicitado_por_email?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusao_solicitacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
      extrato_bancario: {
        Row: {
          conciliado: boolean
          conta_id: string
          created_at: string
          data: string
          descricao: string
          documento: string | null
          empresa_id: string
          hash_unico: string
          id: string
          lancamento_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          conciliado?: boolean
          conta_id: string
          created_at?: string
          data: string
          descricao: string
          documento?: string | null
          empresa_id?: string
          hash_unico: string
          id?: string
          lancamento_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          conciliado?: boolean
          conta_id?: string
          created_at?: string
          data?: string
          descricao?: string
          documento?: string | null
          empresa_id?: string
          hash_unico?: string
          id?: string
          lancamento_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extrato_bancario_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extrato_bancario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extrato_bancario_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cnpj_cpf: string | null
          contato: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa_id: string
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj_cpf?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj_cpf?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_obra: {
        Row: {
          data_upload: string
          diario_id: string | null
          empresa_id: string
          id: string
          imagem_url: string
          obra_id: string
          observacao: string | null
          storage_path: string | null
          tipo: Database["public"]["Enums"]["foto_tipo"]
          uploaded_by: string | null
          visivel_cliente: boolean
        }
        Insert: {
          data_upload?: string
          diario_id?: string | null
          empresa_id?: string
          id?: string
          imagem_url: string
          obra_id: string
          observacao?: string | null
          storage_path?: string | null
          tipo: Database["public"]["Enums"]["foto_tipo"]
          uploaded_by?: string | null
          visivel_cliente?: boolean
        }
        Update: {
          data_upload?: string
          diario_id?: string | null
          empresa_id?: string
          id?: string
          imagem_url?: string
          obra_id?: string
          observacao?: string | null
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["foto_tipo"]
          uploaded_by?: string | null
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fotos_obra_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "diario_obra"
            referencedColumns: ["id"]
          },
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
          centro_custo_id: string | null
          comprovante_path: string | null
          comprovante_url: string | null
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          data_competencia: string
          data_realizado: string | null
          data_vencimento: string | null
          descricao: string
          documento_num: string | null
          empresa_id: string
          etapa_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          fornecedor_nome: string | null
          id: string
          impacto_caixa: boolean
          obra_id: string | null
          observacoes: string | null
          orcamento_item_id: string | null
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
          centro_custo_id?: string | null
          comprovante_path?: string | null
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_competencia: string
          data_realizado?: string | null
          data_vencimento?: string | null
          descricao: string
          documento_num?: string | null
          empresa_id: string
          etapa_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          fornecedor_nome?: string | null
          id?: string
          impacto_caixa?: boolean
          obra_id?: string | null
          observacoes?: string | null
          orcamento_item_id?: string | null
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
          centro_custo_id?: string | null
          comprovante_path?: string | null
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_competencia?: string
          data_realizado?: string | null
          data_vencimento?: string | null
          descricao?: string
          documento_num?: string | null
          empresa_id?: string
          etapa_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          fornecedor_nome?: string | null
          id?: string
          impacto_caixa?: boolean
          obra_id?: string | null
          observacoes?: string | null
          orcamento_item_id?: string | null
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
            foreignKeyName: "lancamentos_financeiros_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
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
            foreignKeyName: "lancamentos_financeiros_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
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
            foreignKeyName: "lancamentos_financeiros_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
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
      listas_opcoes: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          lista: string
          ordem: number
          rotulo: string
          updated_at: string
          valor: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          lista: string
          ordem?: number
          rotulo: string
          updated_at?: string
          valor: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          lista?: string
          ordem?: number
          rotulo?: string
          updated_at?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_opcoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_obra: {
        Row: {
          anexo_path: string | null
          anexo_url: string | null
          centro_custo_id: string | null
          comprador_id: string | null
          created_at: string
          created_by: string | null
          data_compra: string
          descricao: string
          empresa_id: string
          etapa_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          fornecedor: string | null
          id: string
          numero_nf: string | null
          obra_id: string
          observacoes: string | null
          orcamento_item_id: string | null
          quantidade: number
          unidade: string | null
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          anexo_path?: string | null
          anexo_url?: string | null
          centro_custo_id?: string | null
          comprador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao: string
          empresa_id?: string
          etapa_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          fornecedor?: string | null
          id?: string
          numero_nf?: string | null
          obra_id: string
          observacoes?: string | null
          orcamento_item_id?: string | null
          quantidade?: number
          unidade?: string | null
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          anexo_path?: string | null
          anexo_url?: string | null
          centro_custo_id?: string | null
          comprador_id?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao?: string
          empresa_id?: string
          etapa_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          fornecedor?: string | null
          id?: string
          numero_nf?: string | null
          obra_id?: string
          observacoes?: string | null
          orcamento_item_id?: string | null
          quantidade?: number
          unidade?: string | null
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "materiais_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "materiais_obra_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_obra_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          arquivo_nome: string | null
          arquivo_path: string | null
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
          arquivo_nome?: string | null
          arquivo_path?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_medicao: string
          empresa_id?: string
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
          arquivo_nome?: string | null
          arquivo_path?: string | null
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
      modelos_proposta: {
        Row: {
          capa: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          mostra_bdi: boolean
          nome: string
          padrao: boolean
          texto_condicoes: string | null
          texto_introducao: string | null
          texto_rodape: string | null
          updated_at: string
        }
        Insert: {
          capa?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          mostra_bdi?: boolean
          nome: string
          padrao?: boolean
          texto_condicoes?: string | null
          texto_introducao?: string | null
          texto_rodape?: string | null
          updated_at?: string
        }
        Update: {
          capa?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          mostra_bdi?: boolean
          nome?: string
          padrao?: boolean
          texto_condicoes?: string | null
          texto_introducao?: string | null
          texto_rodape?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_proposta_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          aliquota_inss: number
          aliquota_iss: number
          arquivo_pdf_url: string | null
          base_inss: number
          codigo_chamado_avulso: string | null
          created_at: string
          data_emissao: string
          empresa_id: string
          id: string
          medicao_id: string | null
          numero_nf: string
          obra_id: string | null
          pedido_compra_id: string | null
          ret_inss: number
          ret_irrf: number
          ret_iss: number
          ret_pcc: number
          updated_at: string
          valor: number
          valor_bruto: number
          valor_deducoes_inss: number
          valor_liquido: number | null
        }
        Insert: {
          aliquota_inss?: number
          aliquota_iss?: number
          arquivo_pdf_url?: string | null
          base_inss?: number
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_emissao: string
          empresa_id?: string
          id?: string
          medicao_id?: string | null
          numero_nf: string
          obra_id?: string | null
          pedido_compra_id?: string | null
          ret_inss?: number
          ret_irrf?: number
          ret_iss?: number
          ret_pcc?: number
          updated_at?: string
          valor?: number
          valor_bruto: number
          valor_deducoes_inss?: number
          valor_liquido?: number | null
        }
        Update: {
          aliquota_inss?: number
          aliquota_iss?: number
          arquivo_pdf_url?: string | null
          base_inss?: number
          codigo_chamado_avulso?: string | null
          created_at?: string
          data_emissao?: string
          empresa_id?: string
          id?: string
          medicao_id?: string | null
          numero_nf?: string
          obra_id?: string | null
          pedido_compra_id?: string | null
          ret_inss?: number
          ret_irrf?: number
          ret_iss?: number
          ret_pcc?: number
          updated_at?: string
          valor?: number
          valor_bruto?: number
          valor_deducoes_inss?: number
          valor_liquido?: number | null
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
            foreignKeyName: "notas_fiscais_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
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
      notificacao_canais: {
        Row: {
          ativo: boolean
          canal: string
          config: Json
          created_at: string
          empresa_id: string
          id: string
          provedor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal: string
          config?: Json
          created_at?: string
          empresa_id?: string
          id?: string
          provedor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          config?: Json
          created_at?: string
          empresa_id?: string
          id?: string
          provedor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_canais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_envios: {
        Row: {
          canal: string
          chave: string
          destinatario: string
          empresa_id: string
          enviado_em: string
          evento: string
          id: string
          referencia_data: string
          user_id: string
        }
        Insert: {
          canal?: string
          chave: string
          destinatario: string
          empresa_id?: string
          enviado_em?: string
          evento: string
          id?: string
          referencia_data?: string
          user_id: string
        }
        Update: {
          canal?: string
          chave?: string
          destinatario?: string
          empresa_id?: string
          enviado_em?: string
          evento?: string
          id?: string
          referencia_data?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_envios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_preferencias: {
        Row: {
          ativo: boolean
          contas_a_vencer: boolean
          created_at: string
          empresa_id: string
          frequencia: string
          id: string
          medicao_aprovada: boolean
          nf_emitida: boolean
          orcamento_decidido: boolean
          rdo_reprovado: boolean
          recebimento_vencido: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          contas_a_vencer?: boolean
          created_at?: string
          empresa_id?: string
          frequencia?: string
          id?: string
          medicao_aprovada?: boolean
          nf_emitida?: boolean
          orcamento_decidido?: boolean
          rdo_reprovado?: boolean
          recebimento_vencido?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          contas_a_vencer?: boolean
          created_at?: string
          empresa_id?: string
          frequencia?: string
          id?: string
          medicao_aprovada?: boolean
          nf_emitida?: boolean
          orcamento_decidido?: boolean
          rdo_reprovado?: boolean
          recebimento_vencido?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_preferencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_adendos: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string
          id: string
          numero: number
          obra_id: string
          observacoes: string | null
          quantidade: number
          status: string
          titulo: string
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          numero?: number
          obra_id: string
          observacoes?: string | null
          quantidade?: number
          status?: string
          titulo: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          numero?: number
          obra_id?: string
          observacoes?: string | null
          quantidade?: number
          status?: string
          titulo?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_adendos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nome: string
          obra_id: string
          tipo: string | null
          updated_at: string
          visivel_cliente: boolean
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome: string
          obra_id: string
          tipo?: string | null
          updated_at?: string
          visivel_cliente?: boolean
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          obra_id?: string
          tipo?: string | null
          updated_at?: string
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "obra_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_documentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_etapas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nome: string
          obra_id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome: string
          obra_id: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          obra_id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_etapas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_portal_acessos: {
        Row: {
          acessado_em: string
          empresa_id: string
          id: string
          ip: string | null
          obra_id: string
          token_id: string
          user_agent: string | null
        }
        Insert: {
          acessado_em?: string
          empresa_id?: string
          id?: string
          ip?: string | null
          obra_id: string
          token_id: string
          user_agent?: string | null
        }
        Update: {
          acessado_em?: string
          empresa_id?: string
          id?: string
          ip?: string | null
          obra_id?: string
          token_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_portal_acessos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_portal_acessos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_portal_acessos_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "obra_portal_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_portal_tokens: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          empresa_id: string
          expira_em: string | null
          id: string
          obra_id: string
          token: string
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          expira_em?: string | null
          id?: string
          obra_id: string
          token: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          expira_em?: string | null
          id?: string
          obra_id?: string
          token?: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_portal_tokens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_portal_tokens_obra_id_fkey"
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
      obra_status_config: {
        Row: {
          ativo: boolean
          categoria: string
          chave: string
          cor: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
          padrao: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          chave: string
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome: string
          ordem?: number
          padrao?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          chave?: string
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          padrao?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_status_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          arquivada: boolean
          arquivada_em: string | null
          cliente_id: string | null
          codigo_chamado: string
          contrato_qtd_contratada: number
          contrato_qtd_prevista: number
          contrato_unidade: string | null
          contrato_valor_unitario: number
          created_at: string
          created_by: string | null
          data_recebimento: string
          descricao_servico: string | null
          empresa_id: string
          endereco: string | null
          engenheiro_responsavel: string | null
          exemplo: boolean
          id: string
          origem: string
          regiao: Database["public"]["Enums"]["obra_regiao"] | null
          regiao_label: string | null
          status: string
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          arquivada_em?: string | null
          cliente_id?: string | null
          codigo_chamado: string
          contrato_qtd_contratada?: number
          contrato_qtd_prevista?: number
          contrato_unidade?: string | null
          contrato_valor_unitario?: number
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          descricao_servico?: string | null
          empresa_id?: string
          endereco?: string | null
          engenheiro_responsavel?: string | null
          exemplo?: boolean
          id?: string
          origem: string
          regiao?: Database["public"]["Enums"]["obra_regiao"] | null
          regiao_label?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          arquivada_em?: string | null
          cliente_id?: string | null
          codigo_chamado?: string
          contrato_qtd_contratada?: number
          contrato_qtd_prevista?: number
          contrato_unidade?: string | null
          contrato_valor_unitario?: number
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          descricao_servico?: string | null
          empresa_id?: string
          endereco?: string | null
          engenheiro_responsavel?: string | null
          exemplo?: boolean
          id?: string
          origem?: string
          regiao?: Database["public"]["Enums"]["obra_regiao"] | null
          regiao_label?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
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
          bdi_pct: number | null
          codigo: string | null
          created_at: string
          desconto_pct: number
          descricao: string
          descricao_detalhada: string | null
          empresa_id: string
          etapa_id: string | null
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
          bdi_pct?: number | null
          codigo?: string | null
          created_at?: string
          desconto_pct?: number
          descricao: string
          descricao_detalhada?: string | null
          empresa_id: string
          etapa_id?: string | null
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
          bdi_pct?: number | null
          codigo?: string | null
          created_at?: string
          desconto_pct?: number
          descricao?: string
          descricao_detalhada?: string | null
          empresa_id?: string
          etapa_id?: string | null
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
            foreignKeyName: "orcamento_itens_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
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
          bdi_ac: number
          bdi_df: number
          bdi_i: number
          bdi_l: number
          bdi_r: number
          bdi_s: number
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
          bdi_ac?: number
          bdi_df?: number
          bdi_i?: number
          bdi_l?: number
          bdi_r?: number
          bdi_s?: number
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
          bdi_ac?: number
          bdi_df?: number
          bdi_i?: number
          bdi_l?: number
          bdi_r?: number
          bdi_s?: number
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
      ordem_compra_itens: {
        Row: {
          created_at: string
          descricao: string
          empresa_id: string
          etapa_id: string | null
          id: string
          orcamento_item_id: string | null
          ordem: number
          ordem_compra_id: string
          preco_unitario: number
          quantidade: number
          solicitacao_item_id: string | null
          subtotal: number
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao: string
          empresa_id?: string
          etapa_id?: string | null
          id?: string
          orcamento_item_id?: string | null
          ordem?: number
          ordem_compra_id: string
          preco_unitario?: number
          quantidade?: number
          solicitacao_item_id?: string | null
          subtotal?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          empresa_id?: string
          etapa_id?: string | null
          id?: string
          orcamento_item_id?: string | null
          ordem?: number
          ordem_compra_id?: string
          preco_unitario?: number
          quantidade?: number
          solicitacao_item_id?: string | null
          subtotal?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_compra_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "ordens_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_solicitacao_item_id_fkey"
            columns: ["solicitacao_item_id"]
            isOneToOne: false
            referencedRelation: "solicitacao_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_compra_recebimento_itens: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          ordem_compra_item_id: string
          preco_unitario: number
          quantidade: number
          recebimento_id: string
          subtotal: number
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          id?: string
          ordem_compra_item_id: string
          preco_unitario?: number
          quantidade: number
          recebimento_id: string
          subtotal?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          ordem_compra_item_id?: string
          preco_unitario?: number
          quantidade?: number
          recebimento_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordem_compra_recebimento_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_recebimento_itens_ordem_compra_item_id_fkey"
            columns: ["ordem_compra_item_id"]
            isOneToOne: false
            referencedRelation: "ordem_compra_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_recebimento_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "ordem_compra_recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_compra_recebimentos: {
        Row: {
          conta_pagar_id: string | null
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string
          id: string
          numero_nf: string | null
          observacoes: string | null
          ordem_compra_id: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          conta_pagar_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          ordem_compra_id: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          conta_pagar_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          ordem_compra_id?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordem_compra_recebimentos_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_recebimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_recebimentos_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "ordens_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_compra: {
        Row: {
          condicao_pagamento: string | null
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string
          fornecedor_id: string
          frete: number
          id: string
          intervalo_parcelas: number
          numero: string | null
          numero_parcelas: number
          obra_id: string
          observacoes: string | null
          prazo_entrega: string | null
          solicitacao_id: string | null
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          fornecedor_id: string
          frete?: number
          id?: string
          intervalo_parcelas?: number
          numero?: string | null
          numero_parcelas?: number
          obra_id: string
          observacoes?: string | null
          prazo_entrega?: string | null
          solicitacao_id?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          fornecedor_id?: string
          frete?: number
          id?: string
          intervalo_parcelas?: number
          numero?: string | null
          numero_parcelas?: number
          obra_id?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          solicitacao_id?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_compra"
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
          conta_bancaria_id: string | null
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
          conta_bancaria_id?: string | null
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
          conta_bancaria_id?: string | null
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
            foreignKeyName: "parcelas_pagamento_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
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
      perfil_permissao_itens: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          empresa_id: string
          id: string
          modulo: Database["public"]["Enums"]["app_modulo"]
          perfil_id: string
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
          perfil_id: string
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
          perfil_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_permissao_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_permissao_itens_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_permissao"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_permissao: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_permissao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_validade: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          numero: string | null
          pessoa_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome: string
          numero?: string | null
          pessoa_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          numero?: string | null
          pessoa_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_documentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
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
          perfil_id: string | null
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
          perfil_id?: string | null
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
          perfil_id?: string | null
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
          {
            foreignKeyName: "pessoas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_permissao"
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
          aceite_privacidade_em: string | null
          aceite_privacidade_versao: string | null
          aceite_termos_em: string | null
          aceite_termos_versao: string | null
          created_at: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aceite_privacidade_em?: string | null
          aceite_privacidade_versao?: string | null
          aceite_termos_em?: string | null
          aceite_termos_versao?: string | null
          created_at?: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aceite_privacidade_em?: string | null
          aceite_privacidade_versao?: string | null
          aceite_termos_em?: string | null
          aceite_termos_versao?: string | null
          created_at?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposta_versoes: {
        Row: {
          conteudo: Json
          created_at: string
          empresa_id: string
          gerado_por: string | null
          gerado_por_email: string | null
          id: string
          modelo_id: string | null
          orcamento_id: string
          versao: number
        }
        Insert: {
          conteudo: Json
          created_at?: string
          empresa_id?: string
          gerado_por?: string | null
          gerado_por_email?: string | null
          id?: string
          modelo_id?: string | null
          orcamento_id: string
          versao?: number
        }
        Update: {
          conteudo?: Json
          created_at?: string
          empresa_id?: string
          gerado_por?: string | null
          gerado_por_email?: string | null
          id?: string
          modelo_id?: string | null
          orcamento_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_proposta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
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
      recebimento_pagamentos: {
        Row: {
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          observacao: string | null
          recebimento_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacao?: string | null
          recebimento_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacao?: string | null
          recebimento_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimento_pagamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_pagamentos_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          created_at: string
          data_prevista: string | null
          data_recebido: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nota_fiscal_id: string | null
          obra_id: string | null
          observacoes: string | null
          pedido_compra_id: string | null
          status: Database["public"]["Enums"]["recebimento_status"]
          updated_at: string
          valor: number
          valor_recebido: number
        }
        Insert: {
          created_at?: string
          data_prevista?: string | null
          data_recebido?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nota_fiscal_id?: string | null
          obra_id?: string | null
          observacoes?: string | null
          pedido_compra_id?: string | null
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor?: number
          valor_recebido?: number
        }
        Update: {
          created_at?: string
          data_prevista?: string | null
          data_recebido?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nota_fiscal_id?: string | null
          obra_id?: string | null
          observacoes?: string | null
          pedido_compra_id?: string | null
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor?: number
          valor_recebido?: number
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
            foreignKeyName: "recebimentos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
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
      rotina_execucoes: {
        Row: {
          created_at: string
          detalhe: string | null
          execucoes: number
          rotina: string
          ultima_execucao: string
          ultimo_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          execucoes?: number
          rotina: string
          ultima_execucao?: string
          ultimo_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          execucoes?: number
          rotina?: string
          ultima_execucao?: string
          ultimo_status?: string | null
          updated_at?: string
        }
        Relationships: []
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
      solicitacao_itens: {
        Row: {
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          observacao: string | null
          orcamento_item_id: string | null
          ordem: number
          quantidade: number
          solicitacao_id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          solicitacao_id: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          solicitacao_id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_compra: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string
          etapa_id: string | null
          id: string
          numero: string | null
          obra_id: string | null
          observacoes: string | null
          solicitante_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          etapa_id?: string | null
          id?: string
          numero?: string | null
          obra_id?: string | null
          observacoes?: string | null
          solicitante_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string
          etapa_id?: string | null
          id?: string
          numero?: string | null
          obra_id?: string | null
          observacoes?: string | null
          solicitante_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_compra_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "obra_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_compra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_compra_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      suporte_sessoes: {
        Row: {
          created_at: string
          criada_por: string
          criada_por_email: string | null
          empresa_id: string
          encerrada_em: string | null
          expira_em: string
          id: string
          motivo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criada_por: string
          criada_por_email?: string | null
          empresa_id: string
          encerrada_em?: string | null
          expira_em: string
          id?: string
          motivo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criada_por?: string
          criada_por_email?: string | null
          empresa_id?: string
          encerrada_em?: string | null
          expira_em?: string
          id?: string
          motivo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suporte_sessoes_empresa_id_fkey"
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
      admin_consumo_empresas: {
        Args: never
        Returns: {
          empresa_id: string
          empresa_nome: string
          limite_obras: number
          limite_usuarios: number
          obras_ativas: number
          plano: string
          usuarios_ativos: number
        }[]
      }
      admin_exclusoes_pendentes: {
        Args: never
        Returns: {
          created_at: string
          empresa_id: string
          empresa_nome: string
          id: string
          motivo: string
          prazo_em: string
          solicitado_por_email: string
        }[]
      }
      admin_list_empresas_contatos: {
        Args: never
        Returns: {
          admin_email: string
          admin_nome: string
          admin_telefone: string
          empresa_id: string
        }[]
      }
      aplicar_perfil_permissao: {
        Args: { _perfil_id: string; _pessoa_id?: string }
        Returns: number
      }
      aplicar_preset_perfil: {
        Args: { _perfil: Database["public"]["Enums"]["perfil_operacao"] }
        Returns: undefined
      }
      aprovar_orcamento: { Args: { _id: string }; Returns: undefined }
      calc_fatura_fechamento: {
        Args: { _data_compra: string; _dia_fech: number; _offset?: number }
        Returns: string
      }
      calc_fatura_vencimento: {
        Args: {
          _data_compra: string
          _dia_fech: number
          _dia_venc: number
          _offset?: number
        }
        Returns: string
      }
      can_access_contratacao: {
        Args: { _contratacao_id: string; _uid: string }
        Returns: boolean
      }
      can_access_obra: {
        Args: { _obra_id: string; _uid: string }
        Returns: boolean
      }
      categoria_por_papel: {
        Args: { _empresa: string; _papel: string }
        Returns: string
      }
      confirmar_recebimento: {
        Args: { _data?: string; _id: string; _valor: number }
        Returns: {
          created_at: string
          data_prevista: string | null
          data_recebido: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nota_fiscal_id: string | null
          obra_id: string | null
          observacoes: string | null
          pedido_compra_id: string | null
          status: Database["public"]["Enums"]["recebimento_status"]
          updated_at: string
          valor: number
          valor_recebido: number
        }
        SetofOptions: {
          from: "*"
          to: "recebimentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consumo_empresa: { Args: never; Returns: Json }
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
          arquivada: boolean
          arquivada_em: string | null
          cliente_id: string | null
          codigo_chamado: string
          contrato_qtd_contratada: number
          contrato_qtd_prevista: number
          contrato_unidade: string | null
          contrato_valor_unitario: number
          created_at: string
          created_by: string | null
          data_recebimento: string
          descricao_servico: string | null
          empresa_id: string
          endereco: string | null
          engenheiro_responsavel: string | null
          exemplo: boolean
          id: string
          origem: string
          regiao: Database["public"]["Enums"]["obra_regiao"] | null
          regiao_label: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "obras"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decidir_aprovacao: {
        Args: {
          _aprovacao_id: string
          _aprovado: boolean
          _justificativa?: string
        }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      disparar_rotina: {
        Args: { _rotina: string; _url: string }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
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
      get_curva_abc: {
        Args: { _fim?: string; _inicio?: string; _obra_id?: string }
        Returns: {
          classe: string
          descricao: string
          pct: number
          pct_acumulado: number
          valor: number
        }[]
      }
      get_curva_s: {
        Args: { _obra_id: string }
        Returns: {
          mes: string
          previsto: number
          previsto_acum: number
          realizado: number
          realizado_acum: number
        }[]
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
      get_financeiro_kpis: {
        Args: { _fim?: string; _inicio?: string }
        Returns: {
          despesa_prevista: number
          despesa_realizada: number
          receita_prevista: number
          receita_realizada: number
          vencidos_qtd: number
          vencidos_valor: number
        }[]
      }
      get_fluxo_caixa_mensal: {
        Args: {
          _conta_id?: string
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
      get_obras_avanco: {
        Args: never
        Returns: {
          codigo_chamado: string
          descricao: string
          obra_id: string
          pct_financeiro_realizado: number
          pct_fisico_previsto: number
          previsto_ate_hoje: number
          previsto_total: number
          realizado: number
        }[]
      }
      get_orcado_realizado: {
        Args: { _fim?: string; _inicio?: string; _obra_id: string }
        Returns: {
          comprometido: number
          etapa_id: string
          etapa_nome: string
          item_descricao: string
          item_id: string
          pct_consumido: number
          quantidade_orcada: number
          realizado: number
          saldo: number
          valor_orcado: number
        }[]
      }
      get_portal_obra: {
        Args: { _ip?: string; _token: string; _user_agent?: string }
        Returns: Json
      }
      get_retencoes_mensais: {
        Args: { _fim: string; _inicio: string }
        Returns: {
          inss: number
          irrf: number
          iss: number
          mes: string
          pcc: number
          total: number
        }[]
      }
      get_saldos_contas: {
        Args: { _empresa_id: string }
        Returns: {
          banco: string
          conta_id: string
          movimento: number
          nao_conciliado: number
          nome: string
          saldo_atual: number
          saldo_inicial: number
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
      limites_plano: {
        Args: { _empresa_id: string }
        Returns: {
          limite_obras: number
          limite_usuarios: number
          plano_nome: string
        }[]
      }
      mesmo_tenant: {
        Args: { _empresa: string; _id: string; _tabela: unknown }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      obra_status_padrao: {
        Args: { _categoria: string; _empresa: string }
        Returns: string
      }
      pagar_fatura_cartao: {
        Args: {
          _cartao_id: string
          _data_pagamento?: string
          _vencimento: string
        }
        Returns: number
      }
      proximo_numero_documento: {
        Args: { _data?: string; _empresa_id: string; _tipo: string }
        Returns: string
      }
      reabrir_fatura_cartao: {
        Args: { _cartao_id: string; _vencimento: string }
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
      receber_ordem_compra: {
        Args: {
          _data: string
          _itens: Json
          _numero_nf: string
          _observacoes?: string
          _ordem_id: string
        }
        Returns: string
      }
      salvar_orcamento: {
        Args: { _itens: Json; _orcamento: Json }
        Returns: string
      }
      seed_categorias_financeiras: {
        Args: { _empresa_id: string }
        Returns: undefined
      }
      seed_listas_opcoes: { Args: { _empresa_id: string }; Returns: undefined }
      seed_perfis_permissao: {
        Args: { _empresa_id: string }
        Returns: undefined
      }
      signup_create_company: {
        Args: { _nome_empresa: string }
        Returns: string
      }
      solicitar_aprovacao: {
        Args: {
          _descricao?: string
          _documento: string
          _registro_id: string
          _valor: number
        }
        Returns: number
      }
      suporte_sessao_ativa: { Args: { _empresa_id: string }; Returns: boolean }
      tenant_can_write: { Args: { _empresa_id: string }; Returns: boolean }
      tenant_match: { Args: { _empresa_id: string }; Returns: boolean }
      verificar_razao: {
        Args: never
        Returns: {
          diferenca: number
          obra_id: string
          origem: string
          soma_origem: number
          soma_razao: number
        }[]
      }
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
        | "contratos"
        | "medicoes"
        | "diario"
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
      perfil_operacao: "prestadora_servico" | "obra_propria" | "manutencao"
      pessoa_status: "ativo" | "inativo"
      pessoa_tipo: "terceirizado" | "administrativo" | "operacional"
      rc_status: "aguardando" | "recebido"
      recebimento_status: "a_receber" | "recebido" | "parcial"
      regime_tributario:
        | "simples_anexo_iii_v"
        | "simples_anexo_iv"
        | "lucro_presumido"
        | "lucro_real"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "contratos",
        "medicoes",
        "diario",
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
      perfil_operacao: ["prestadora_servico", "obra_propria", "manutencao"],
      pessoa_status: ["ativo", "inativo"],
      pessoa_tipo: ["terceirizado", "administrativo", "operacional"],
      rc_status: ["aguardando", "recebido"],
      recebimento_status: ["a_receber", "recebido", "parcial"],
      regime_tributario: [
        "simples_anexo_iii_v",
        "simples_anexo_iv",
        "lucro_presumido",
        "lucro_real",
      ],
      vistoria_status: ["pendente", "vistoriado"],
    },
  },
} as const
