import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  PESSOA_TIPO_LIST, PESSOA_TIPO_LABEL, PessoaTipo, CARGOS_OPERACIONAIS,
} from "@/lib/pessoas-helpers";
import { PermissoesEditor } from "./PermissoesEditor";

type Pessoa = {
  id?: string;
  tipo: PessoaTipo;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cargo: string | null;
  tipo_servico: string | null;
  data_admissao: string | null;
  chave_pix: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  observacoes: string | null;
  status: "ativo" | "inativo";
};

const empty = (tipo: PessoaTipo): Pessoa => ({
  tipo,
  nome: "",
  cpf_cnpj: "",
  telefone: "",
  email: "",
  endereco: "",
  cargo: "",
  tipo_servico: "",
  data_admissao: null,
  chave_pix: "",
  banco: "",
  agencia: "",
  conta: "",
  observacoes: "",
  status: "ativo",
});

export function PessoaFormDialog({
  open, onOpenChange, defaultTipo = "operacional", pessoa,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTipo?: PessoaTipo;
  pessoa?: any | null;
}) {
  const qc = useQueryClient();
  const editing = !!pessoa?.id;
  const [form, setForm] = useState<Pessoa>(empty(defaultTipo));

  useEffect(() => {
    if (pessoa) {
      setForm({
        ...empty(pessoa.tipo),
        ...pessoa,
        data_admissao: pessoa.data_admissao ?? null,
      });
    } else {
      setForm(empty(defaultTipo));
    }
  }, [pessoa, defaultTipo, open]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        tipo: form.tipo,
        nome: form.nome.trim(),
        cpf_cnpj: form.cpf_cnpj || null,
        telefone: form.telefone || null,
        email: form.email?.toLowerCase().trim() || null,
        endereco: form.endereco || null,
        cargo: form.cargo || null,
        tipo_servico: form.tipo_servico || null,
        data_admissao: form.data_admissao || null,
        chave_pix: form.chave_pix || null,
        banco: form.banco || null,
        agencia: form.agencia || null,
        conta: form.conta || null,
        observacoes: form.observacoes || null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("pessoas").update(payload).eq("id", pessoa.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("pessoas").insert([{ ...payload, created_by: u.user?.id ?? null }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Pessoa atualizada" : "Pessoa cadastrada");
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isTerceirizado = form.tipo === "terceirizado";
  const isAdmin = form.tipo === "administrativo";
  const isOperacional = form.tipo === "operacional";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar pessoa" : "Cadastrar pessoa"}</DialogTitle>
          <DialogDescription>
            Preencha os dados conforme o tipo de cadastro.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v: PessoaTipo) => setForm({ ...form, tipo: v })}
              disabled={editing}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PESSOA_TIPO_LIST.map((t) => (
                  <SelectItem key={t} value={t}>{PESSOA_TIPO_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v: "ativo" | "inativo") => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Nome completo *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{isTerceirizado ? "CPF ou CNPJ" : "CPF"}</Label>
            <Input value={form.cpf_cnpj ?? ""} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone</Label>
            <Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="usado para vincular ao login"
            />
          </div>

          {(isAdmin || isOperacional) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Data de admissão</Label>
              <Input
                type="date"
                value={form.data_admissao ?? ""}
                onChange={(e) => setForm({ ...form, data_admissao: e.target.value || null })}
              />
            </div>
          )}

          {isTerceirizado && (
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Endereço</Label>
              <Input value={form.endereco ?? ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
          )}

          {isAdmin && (
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Cargo</Label>
              <Input
                value={form.cargo ?? ""}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                placeholder="Ex: Supervisor de obras, Coordenador"
              />
            </div>
          )}

          {isOperacional && (
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Função</Label>
              <Select
                value={form.cargo ?? ""}
                onValueChange={(v) => setForm({ ...form, cargo: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                <SelectContent>
                  {CARGOS_OPERACIONAIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {isTerceirizado && (
            <>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Tipo de serviço principal</Label>
                <Input
                  value={form.tipo_servico ?? ""}
                  onChange={(e) => setForm({ ...form, tipo_servico: e.target.value })}
                  placeholder="Ex: Hidráulica, alvenaria, pintura"
                />
              </div>
              <div className="space-y-1.5 col-span-2 pt-2 border-t">
                <Label className="text-xs font-semibold">Dados de pagamento</Label>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Chave Pix</Label>
                <Input value={form.chave_pix ?? ""} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Banco</Label>
                <Input value={form.banco ?? ""} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agência</Label>
                <Input value={form.agencia ?? ""} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Conta</Label>
                <Input value={form.conta ?? ""} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
              </div>
            </>
          )}

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              value={form.observacoes ?? ""}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.nome.trim() || mut.isPending}>
            {mut.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
