import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Pencil, Phone } from "lucide-react";
import { PESSOA_TIPO_LABEL, PessoaTipo } from "@/lib/pessoas-helpers";
import { PessoaDocumentosTab } from "@/components/equipes/PessoaDocumentosTab";
import { PessoaObrasVinculadasTab } from "@/components/equipes/PessoaObrasVinculadasTab";
import { TerceirizadoObrasTab } from "@/components/equipes/TerceirizadoObrasTab";
import { PermissoesEditor } from "@/components/equipes/PermissoesEditor";
import { PessoaFormDialog } from "@/components/equipes/PessoaFormDialog";
import { formatDateBR } from "@/lib/date";

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

export default function PessoaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: pessoa, isLoading } = useQuery({
    queryKey: ["pessoa", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("pessoas").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!pessoa) return <p className="text-sm text-muted-foreground">Cadastro não encontrado.</p>;

  const tipo = pessoa.tipo as PessoaTipo;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/equipes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{pessoa.nome}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{PESSOA_TIPO_LABEL[tipo]}</Badge>
              <Badge variant={pessoa.status === "ativo" ? "default" : "secondary"}>
                {pessoa.status === "ativo" ? "Ativo" : "Inativo"}
              </Badge>
              {pessoa.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{pessoa.email}</span>}
              {pessoa.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{pessoa.telefone}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar dados
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Info label="CPF/CNPJ" value={pessoa.cpf_cnpj} />
        <Info label={tipo === "terceirizado" ? "Serviço" : "Função"} value={tipo === "terceirizado" ? pessoa.tipo_servico : pessoa.cargo} />
        <Info label="Admissão" value={pessoa.data_admissao ? formatDateBR(pessoa.data_admissao) : null} />
        <Info label="Endereço" value={pessoa.endereco} />
      </div>

      <Tabs defaultValue="documentos">
        <TabsList>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="obras">Obras vinculadas</TabsTrigger>
          {tipo === "terceirizado" && <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>}
          {tipo === "administrativo" && <TabsTrigger value="permissoes">Permissões</TabsTrigger>}
        </TabsList>
        <TabsContent value="documentos" className="mt-4">
          <PessoaDocumentosTab pessoaId={pessoa.id} />
        </TabsContent>
        <TabsContent value="obras" className="mt-4">
          <PessoaObrasVinculadasTab pessoaId={pessoa.id} tipo={tipo} />
        </TabsContent>
        {tipo === "terceirizado" && (
          <TabsContent value="pagamentos" className="mt-4">
            <TerceirizadoObrasTab pessoaId={pessoa.id} />
          </TabsContent>
        )}
        {tipo === "administrativo" && (
          <TabsContent value="permissoes" className="mt-4">
            <PermissoesEditor pessoaId={pessoa.id} />
          </TabsContent>
        )}
      </Tabs>

      <PessoaFormDialog open={editOpen} onOpenChange={setEditOpen} defaultTipo={tipo} pessoa={pessoa} />
    </div>
  );
}
