import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  CAMPOS_INSUMO, CampoInsumo, ConferenciaImportacao, conferirInsumos, formatoReconhecido, sugerirMapeamento,
} from "@/lib/base-custos";

export function ImportarBaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState("");
  const [cabecalho, setCabecalho] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<unknown[][]>([]);
  const [mapa, setMapa] = useState<CampoInsumo[]>([]);
  const [tabela, setTabela] = useState("");
  const [mes, setMes] = useState("");
  const [salvando, setSalvando] = useState(false);

  const conferencia: ConferenciaImportacao | null =
    linhas.length && formatoReconhecido(mapa) ? conferirInsumos(linhas, mapa) : null;

  const limpar = () => {
    setArquivo(""); setCabecalho([]); setLinhas([]); setMapa([]); setTabela(""); setMes("");
  };

  const lerArquivo = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
    const primeira = (matriz[0] ?? []).map((c) => String(c ?? ""));
    setArquivo(file.name);
    setCabecalho(primeira);
    setLinhas(matriz.slice(1));
    setMapa(sugerirMapeamento(primeira));
  };

  const gravar = async () => {
    if (!conferencia || conferencia.erros.length) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("importar_insumos" as never, {
        _linhas: conferencia.linhas,
        _tabela: tabela,
        _mes: mes ? `${mes}-01` : null,
        _arquivo: arquivo,
      } as never);
      if (error) throw error;
      const r = (data ?? {}) as { novas?: number; atualizadas?: number };
      toast.success(`${r.novas ?? 0} insumos novos e ${r.atualizadas ?? 0} atualizados.`);
      await qc.invalidateQueries({ queryKey: [empresaId, "insumos"] });
      limpar();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar. Nada foi gravado.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) limpar(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar insumos de uma planilha</DialogTitle>
          <DialogDescription>
            Excel ou CSV. Confira as colunas antes de gravar; nada é gravado pela metade — ou entra tudo, ou nada.
            A base de referência (SINAPI e similares) é sempre o arquivo que você carrega: o sistema não distribui
            nenhuma tabela pública.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); }}
              />
            </div>
            <div className="space-y-1">
              <Label>Tabela de referência</Label>
              <Input value={tabela} onChange={(e) => setTabela(e.target.value)} placeholder="SINAPI-SP (vazio = base própria)" />
            </div>
            <div className="space-y-1">
              <Label>Mês de referência</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </div>
          </div>

          {cabecalho.length > 0 && !formatoReconhecido(mapa) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Formato não reconhecido</AlertTitle>
              <AlertDescription>
                Não identifiquei as colunas de código, descrição e preço. Escolha a mão, abaixo, qual coluna é cada
                coisa. As primeiras linhas do arquivo estão logo em seguida para conferência.
              </AlertDescription>
            </Alert>
          )}

          {cabecalho.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Colunas reconhecidas</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {cabecalho.map((col, i) => (
                  <div key={`${col}-${i}`} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">{col || `Coluna ${i + 1}`}</span>
                    <Select
                      value={mapa[i] ?? "ignorar"}
                      onValueChange={(v) => setMapa((m) => m.map((x, k) => (k === i ? (v as CampoInsumo) : x === v ? "ignorar" : x)))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignorar">Ignorar</SelectItem>
                        {CAMPOS_INSUMO.map((c) => (
                          <SelectItem key={c.campo} value={c.campo}>{c.rotulo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {linhas.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>{cabecalho.map((c, i) => <TableHead key={i}>{c || `Coluna ${i + 1}`}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.slice(0, 5).map((l, i) => (
                    <TableRow key={i}>
                      {cabecalho.map((_, k) => <TableCell key={k} className="text-xs">{String(l[k] ?? "")}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {conferencia && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <div>Linhas lidas: <strong>{conferencia.total}</strong></div>
              <div>Prontas para gravar: <strong>{conferencia.linhas.length}</strong></div>
              <div className={conferencia.erros.length ? "text-destructive font-medium" : ""}>
                Com erro: <strong>{conferencia.erros.length}</strong>
              </div>
              {conferencia.erros.length > 0 && (
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-destructive">
                  {conferencia.erros.slice(0, 50).map((e) => (
                    <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>
                  ))}
                </ul>
              )}
              {conferencia.erros.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Corrija a planilha e carregue de novo. Enquanto houver erro, nada é gravado.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => void gravar()}
            disabled={salvando || !conferencia || conferencia.erros.length > 0 || conferencia.linhas.length === 0}
          >
            {salvando ? "Gravando…" : "Confirmar importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
