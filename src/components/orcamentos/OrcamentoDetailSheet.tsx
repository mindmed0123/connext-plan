import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/obra-helpers";
import { format, addDays, parseISO } from "date-fns";
import { FileDown, Pencil, Check, X, MessageSquare } from "lucide-react";
import { gerarOrcamentoPDF } from "@/lib/orcamento-pdf";
import { toast } from "sonner";
import { ORC_STATUS_BADGE } from "./orc-helpers";

export function OrcamentoDetailSheet({
  orcamentoId, open, onOpenChange, onEdit,
}: {
  orcamentoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (id: string) => void;
}) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["orc-detail", orcamentoId],
    enabled: !!orcamentoId && open,
    queryFn: async () => {
      const [{ data: orc }, { data: itens }] = await Promise.all([
        supabase.from("orcamentos").select("*, obras(codigo_chamado)").eq("id", orcamentoId!).single(),
        supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId!).order("ordem"),
      ]);
      return { orc, itens: itens ?? [] };
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: "aprovado" | "reprovado" | "em_negociacao") => {
      const { error } = await supabase.from("orcamentos").update({ status }).eq("id", orcamentoId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["orc-detail", orcamentoId] });
      qc.invalidateQueries({ queryKey: ["orcamentos"] });
      qc.invalidateQueries({ queryKey: ["all-orcamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePDF = async () => {
    if (!data?.orc || !empresaId) return;
    const { data: empresa } = await supabase.from("empresas").select("*").eq("id", empresaId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = (empresa ?? {}) as any;
    await gerarOrcamentoPDF(data.orc, data.itens, {
      nome: e.nome ?? "Empresa",
      cnpj: e.cnpj ?? null,
      inscricao_estadual: e.inscricao_estadual ?? null,
      endereco: e.endereco ?? null,
      bairro: e.bairro ?? null,
      cidade: e.cidade ?? null,
      uf: e.uf ?? null,
      cep: e.cep ?? null,
      telefone: e.telefone ?? null,
      logo_url: e.logo_url ?? null,
    });
    toast.success("PDF gerado!");
  };

  const orc = data?.orc;
  const itens = data?.itens ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{(orc as { numero?: string } | null)?.numero || orc?.numero_orcamento || "Orçamento"}</SheetTitle>
            {orc && <Badge className={ORC_STATUS_BADGE[orc.status]?.className}>{ORC_STATUS_BADGE[orc.status]?.label}</Badge>}
          </div>
        </SheetHeader>

        {!orc ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Chamado:</span> <span className="font-medium">{(orc as { codigo_chamado?: string | null }).codigo_chamado || orc.obras?.codigo_chamado || "—"}</span></div>
              <div><span className="text-muted-foreground">Data:</span> {format(parseISO(orc.data_orcamento), "dd/MM/yyyy")}</div>
              <div><span className="text-muted-foreground">Validade:</span> {orc.validade_dias} dias (até {format(addDays(parseISO(orc.data_orcamento), orc.validade_dias), "dd/MM/yyyy")})</div>
              <div><span className="text-muted-foreground">Pagamento:</span> {(orc as { condicao_pagamento?: string }).condicao_pagamento || orc.condicoes_pagamento || "—"}</div>
              {orc.titulo && <div className="col-span-2"><span className="text-muted-foreground">Título:</span> {orc.titulo}</div>}
              {(orc as { objeto?: string }).objeto && (
                <div className="col-span-2"><span className="text-muted-foreground">Objeto:</span> {(orc as { objeto?: string }).objeto}</div>
              )}
              {(orc as { local_execucao?: string }).local_execucao && (
                <div><span className="text-muted-foreground">Local:</span> {(orc as { local_execucao?: string }).local_execucao}</div>
              )}
              {(orc as { prazo_execucao?: string }).prazo_execucao && (
                <div><span className="text-muted-foreground">Prazo:</span> {(orc as { prazo_execucao?: string }).prazo_execucao}</div>
              )}
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Un.</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">P.Unit</TableHead>
                    <TableHead className="text-right">ISS%</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.descricao}</TableCell>
                      <TableCell className="text-center">{it.unidade}</TableCell>
                      <TableCell className="text-right">{Number(it.quantidade).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(it.preco_unitario))}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {Number((it as { aliquota_iss?: number }).aliquota_iss ?? 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(it.subtotal))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {Number((orc as { desconto_global_pct?: number }).desconto_global_pct ?? 0) > 0 && (
              <div className="text-sm text-right text-muted-foreground">
                Desconto global: {Number((orc as { desconto_global_pct?: number }).desconto_global_pct).toFixed(2)}%
              </div>
            )}

            <div className="rounded-lg bg-primary/10 p-4 text-right">
              <div className="text-xs text-muted-foreground">TOTAL</div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(Number((orc as { valor_total?: number }).valor_total ?? orc.valor_orcamento))}
              </div>
            </div>

            {orc.observacoes && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Observações</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{orc.observacoes}</p>
              </div>
            )}


            <div className="flex flex-wrap gap-2 pt-3 border-t">
              <Button variant="outline" onClick={handlePDF}><FileDown className="h-4 w-4" /> Gerar PDF</Button>
              <Button variant="outline" onClick={() => onEdit(orc.id)}><Pencil className="h-4 w-4" /> Editar</Button>
              {orc.status === "enviado" && (
                <Button variant="outline" onClick={() => updateStatus.mutate("em_negociacao")}>
                  <MessageSquare className="h-4 w-4" /> Em negociação
                </Button>
              )}
              {(orc.status === "enviado" || orc.status === "em_negociacao") && (
                <>
                  <Button onClick={() => updateStatus.mutate("aprovado")} className="bg-emerald-600 hover:bg-emerald-700">
                    <Check className="h-4 w-4" /> Aprovar
                  </Button>
                  <Button variant="destructive" onClick={() => updateStatus.mutate("reprovado")}>
                    <X className="h-4 w-4" /> Reprovar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
