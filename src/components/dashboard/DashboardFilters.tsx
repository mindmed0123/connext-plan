import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OBRA_STATUS_LABEL, OBRA_STATUS_LIST } from "@/lib/obra-helpers";
import { RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardFilters as F } from "@/hooks/useDashboardData";

interface Props {
  filters: F;
  setFilters: (f: F) => void;
  engenheiros: string[];
  pessoas: { id: string; nome: string; tipo: string }[];
}

export function DashboardFilters({ filters, setFilters, engenheiros, pessoas }: Props) {
  const reset = () => setFilters({ regiao: "todas", engenheiro: "todos", status: "todas", responsavelId: "todos", terceirizadoId: "todos" });
  const responsaveis = pessoas.filter((p) => p.tipo !== "terceirizado");
  const terceirizados = pessoas.filter((p) => p.tipo === "terceirizado");

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">De</label>
          <Input type="date" value={filters.from ?? ""} onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })} className="h-9" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Até</label>
          <Input type="date" value={filters.to ?? ""} onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })} className="h-9" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Região</label>
          <Select value={filters.regiao ?? "todas"} onValueChange={(v) => setFilters({ ...filters, regiao: v as any })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {Object.entries(REGIAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Etapa</label>
          <Select value={filters.status ?? "todas"} onValueChange={(v) => setFilters({ ...filters, status: v as any })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {OBRA_STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{OBRA_STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Engenheiro</label>
          <Select value={filters.engenheiro ?? "todos"} onValueChange={(v) => setFilters({ ...filters, engenheiro: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {engenheiros.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Responsável</label>
          <Select value={filters.responsavelId ?? "todos"} onValueChange={(v) => setFilters({ ...filters, responsavelId: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {responsaveis.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Terceirizado</label>
          <Select value={filters.terceirizadoId ?? "todos"} onValueChange={(v) => setFilters({ ...filters, terceirizadoId: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {terceirizados.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="mr-2 h-3.5 w-3.5" />Limpar filtros</Button>
      </div>
    </div>
  );
}
