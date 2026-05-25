import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";

export function FaturamentoTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [rc, setRc] = useState({ numero_rc: "", data_rc: getTodayDateInputValue() });
  const [pc, setPc] = useState({ numero_pedido: "", data_recebimento: getTodayDateInputValue(), valor: "" });
  const [nf, setNf] = useState({ numero_nf: "", data_emissao: getTodayDateInputValue(), valor: "" });
  const [rec, setRec] = useState({ valor: "", data_prevista: "" });

  const { data: rcs } = useQuery({
    queryKey: ["rcs", obraId],
    queryFn: async () => (await supabase.from("rcs").select("*").eq("obra_id", obraId).order("created_at", { ascending: false })).data,
  });
  const { data: pcs } = useQuery({
    queryKey: ["pcs", obraId],
    queryFn: async () => (await supabase.from("pedidos_compra").select("*").eq("obra_id", obraId).order("created_at", { ascending: false })).data,
  });
  const { data: nfs } = useQuery({
    queryKey: ["nfs", obraId],
    queryFn: async () => (await supabase.from("notas_fiscais").select("*").eq("obra_id", obraId).order("created_at", { ascending: false })).data,
  });
  const { data: recs } = useQuery({
    queryKey: ["recs", obraId],
    queryFn: async () => (await supabase.from("recebimentos").select("*").eq("obra_id", obraId).order("created_at", { ascending: false })).data,
  });

  const log = async (evento: string, detalhes: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("obra_timeline").insert([{ obra_id: obraId, user_id: u.user?.id, evento, detalhes }]);
  };

  const addRc = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rcs").insert([{ obra_id: obraId, ...rc, status: "recebido" }]);
      if (error) throw error;
      await log("RC adicionada", `Nº ${rc.numero_rc}`);
    },
    onSuccess: () => {
      toast.success("RC adicionada"); qc.invalidateQueries({ queryKey: ["rcs", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] }); setRc({ ...rc, numero_rc: "" });
    },
  });

  const addPc = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pedidos_compra").insert([{
        obra_id: obraId, numero_pedido: pc.numero_pedido, data_recebimento: pc.data_recebimento,
        valor: parseFloat(pc.valor) || 0, status: "recebido",
      }]);
      if (error) throw error;
      await log("Pedido de compra registrado", `Nº ${pc.numero_pedido} • ${formatCurrency(pc.valor)}`);
    },
    onSuccess: () => {
      toast.success("Pedido registrado"); qc.invalidateQueries({ queryKey: ["pcs", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setPc({ ...pc, numero_pedido: "", valor: "" });
    },
  });

  const addNf = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notas_fiscais").insert([{
        obra_id: obraId, numero_nf: nf.numero_nf, data_emissao: nf.data_emissao, valor: parseFloat(nf.valor) || 0,
      }]);
      if (error) throw error;
      await log("Nota fiscal emitida", `NF ${nf.numero_nf} • ${formatCurrency(nf.valor)}`);
    },
    onSuccess: () => {
      toast.success("NF registrada"); qc.invalidateQueries({ queryKey: ["nfs", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setNf({ ...nf, numero_nf: "", valor: "" });
    },
  });

  const addRec = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recebimentos").insert([{
        obra_id: obraId, valor: parseFloat(rec.valor) || 0,
        data_prevista: rec.data_prevista || null, status: "a_receber",
      }]);
      if (error) throw error;
      await log("Recebimento previsto", `${formatCurrency(rec.valor)}${rec.data_prevista ? ` em ${formatDateBR(rec.data_prevista)}` : ""}`);
    },
    onSuccess: () => {
      toast.success("Recebimento previsto"); qc.invalidateQueries({ queryKey: ["recs", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setRec({ valor: "", data_prevista: "" });
    },
  });

  return (
    <div className="space-y-4">
      {/* RC */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <h3 className="text-sm font-semibold">Requisição de Compra (RC)</h3>
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-xs">Nº RC</Label><Input value={rc.numero_rc} onChange={(e) => setRc({ ...rc, numero_rc: e.target.value })} /></div>
          <div><Label className="text-xs">Data</Label><Input type="date" value={rc.data_rc} onChange={(e) => setRc({ ...rc, data_rc: e.target.value })} /></div>
          <div className="flex items-end"><Button size="sm" className="w-full" onClick={() => addRc.mutate()} disabled={!rc.numero_rc}>Adicionar RC</Button></div>
        </div>
        {rcs?.map((r) => <p key={r.id} className="text-xs text-muted-foreground">• RC {r.numero_rc} ({formatDateBR(r.data_rc)})</p>)}
      </div>

      {/* PC */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <h3 className="text-sm font-semibold">Pedido de Compra</h3>
        <div className="grid grid-cols-4 gap-2">
          <div><Label className="text-xs">Nº pedido</Label><Input value={pc.numero_pedido} onChange={(e) => setPc({ ...pc, numero_pedido: e.target.value })} /></div>
          <div><Label className="text-xs">Data</Label><Input type="date" value={pc.data_recebimento} onChange={(e) => setPc({ ...pc, data_recebimento: e.target.value })} /></div>
          <div><Label className="text-xs">Valor</Label><Input type="number" step="0.01" value={pc.valor} onChange={(e) => setPc({ ...pc, valor: e.target.value })} /></div>
          <div className="flex items-end"><Button size="sm" className="w-full" onClick={() => addPc.mutate()} disabled={!pc.numero_pedido}>Adicionar</Button></div>
        </div>
        {pcs?.map((p) => <p key={p.id} className="text-xs text-muted-foreground">• PC {p.numero_pedido} ({formatCurrency(p.valor)})</p>)}
      </div>

      {/* NF */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <h3 className="text-sm font-semibold">Nota Fiscal</h3>
        <div className="grid grid-cols-4 gap-2">
          <div><Label className="text-xs">Nº NF</Label><Input value={nf.numero_nf} onChange={(e) => setNf({ ...nf, numero_nf: e.target.value })} /></div>
          <div><Label className="text-xs">Emissão</Label><Input type="date" value={nf.data_emissao} onChange={(e) => setNf({ ...nf, data_emissao: e.target.value })} /></div>
          <div><Label className="text-xs">Valor</Label><Input type="number" step="0.01" value={nf.valor} onChange={(e) => setNf({ ...nf, valor: e.target.value })} /></div>
          <div className="flex items-end"><Button size="sm" className="w-full" onClick={() => addNf.mutate()} disabled={!nf.numero_nf}>Adicionar</Button></div>
        </div>
        {nfs?.map((n) => <p key={n.id} className="text-xs text-muted-foreground">• NF {n.numero_nf} ({formatCurrency(n.valor)})</p>)}
      </div>

      {/* Recebimentos */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <h3 className="text-sm font-semibold">Recebimentos</h3>
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-xs">Valor</Label><Input type="number" step="0.01" value={rec.valor} onChange={(e) => setRec({ ...rec, valor: e.target.value })} /></div>
          <div><Label className="text-xs">Data prevista</Label><Input type="date" value={rec.data_prevista} onChange={(e) => setRec({ ...rec, data_prevista: e.target.value })} /></div>
          <div className="flex items-end"><Button size="sm" className="w-full" onClick={() => addRec.mutate()} disabled={!rec.valor}>Adicionar</Button></div>
        </div>
        {recs?.map((r) => (
          <p key={r.id} className="text-xs text-muted-foreground">
            • {formatCurrency(r.valor)} — {r.status === "recebido" ? "✓ recebido" : `previsto ${formatDateBR(r.data_prevista)}`}
          </p>
        ))}
      </div>
    </div>
  );
}
