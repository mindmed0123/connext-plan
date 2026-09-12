import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/obra-helpers";
import { useSaldosContas } from "@/hooks/useContasBancarias";

export function SaldosContas() {
  const { data: saldos = [] } = useSaldosContas();
  const [conta, setConta] = useState("all");

  const lista = (saldos as any[]).filter((c) => conta === "all" || c.conta_id === conta);
  const total = lista.reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
  const naoConciliado = lista.reduce((s, c) => s + Number(c.nao_conciliado ?? 0), 0);

  if ((saldos as any[]).length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Saldo em contas</CardTitle>
        <Select value={conta} onValueChange={setConta}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {(saldos as any[]).map((c) => <SelectItem key={c.conta_id} value={c.conta_id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-bold">{formatCurrency(total)}</div>
        {naoConciliado > 0 && <Badge variant="destructive">Não conciliado: {formatCurrency(naoConciliado)}</Badge>}
        <div className="grid gap-1 pt-2 text-sm text-muted-foreground">
          {lista.map((c) => (
            <div key={c.conta_id} className="flex justify-between">
              <span>{c.nome}</span>
              <span className="font-medium text-foreground">{formatCurrency(Number(c.saldo_atual))}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
