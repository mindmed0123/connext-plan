import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Pencil, Mail, Phone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PessoaFormDialog } from "@/components/equipes/PessoaFormDialog";
import { PESSOA_TIPO_LABEL, PESSOA_TIPO_DESC, PessoaTipo } from "@/lib/pessoas-helpers";
import { useUserRole } from "@/hooks/useUserRole";

function PessoasList({ tipo }: { tipo: PessoaTipo }) {
  const { isAdmin } = useUserRole();
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pessoas", tipo, search],
    queryFn: async () => {
      let q = supabase.from("pessoas").select("*").eq("tipo", tipo).order("nome");
      if (search.trim()) q = q.ilike("nome", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  if (!isAdmin) {
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <ShieldAlert className="h-5 w-5" />
        Você não tem permissão para visualizar este cadastro.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{PESSOA_TIPO_DESC[tipo]}</p>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Cadastrar
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>{tipo === "terceirizado" ? "Serviço" : "Cargo"}</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">Nenhum cadastro ainda.</TableCell></TableRow>
            )}
            {data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-sm">{tipo === "terceirizado" ? (p.tipo_servico || "—") : (p.cargo || "—")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div className="flex flex-col gap-0.5">
                    {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                    {p.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telefone}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={p.status === "ativo" ? "default" : "secondary"}>
                    {p.status === "ativo" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpenForm(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PessoaFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        defaultTipo={tipo}
        pessoa={editing}
      />
    </div>
  );
}

export default function Equipes() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Equipes</h1>
        <p className="text-sm text-muted-foreground">Cadastro de terceirizados, administrativos e operacionais</p>
      </div>

      <Tabs defaultValue="terceirizado">
        <TabsList>
          <TabsTrigger value="terceirizado">{PESSOA_TIPO_LABEL.terceirizado}</TabsTrigger>
          <TabsTrigger value="administrativo">{PESSOA_TIPO_LABEL.administrativo}</TabsTrigger>
          <TabsTrigger value="operacional">{PESSOA_TIPO_LABEL.operacional}</TabsTrigger>
        </TabsList>
        <TabsContent value="terceirizado" className="mt-4"><PessoasList tipo="terceirizado" /></TabsContent>
        <TabsContent value="administrativo" className="mt-4"><PessoasList tipo="administrativo" /></TabsContent>
        <TabsContent value="operacional" className="mt-4"><PessoasList tipo="operacional" /></TabsContent>
      </Tabs>
    </div>
  );
}
