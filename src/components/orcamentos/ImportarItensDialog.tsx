import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";

export type ItemImportado = {
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  etapa_nome?: string | null;
};

const CAMPOS = [
  { chave: "descricao", label: "Descrição", obrigatorio: true },
  { chave: "unidade", label: "Unidade", obrigatorio: false },
  { chave: "quantidade", label: "Quantidade", obrigatorio: true },
  { chave: "preco_unitario", label: "Preço unitário", obrigatorio: true },
  { chave: "etapa_nome", label: "Etapa", obrigatorio: false },
] as const;

const PALPITES: Record<string, string[]> = {
  descricao: ["descricao", "descrição", "item", "servico", "serviço", "discriminacao", "discriminação"],
  unidade: ["unidade", "un", "und", "medida"],
  quantidade: ["quantidade", "qtd", "qtde", "quant"],
  preco_unitario: ["preco", "preço", "valor", "unitario", "unitário", "p.unit", "preco unitario"],
  etapa_nome: ["etapa", "fase", "grupo"],
};

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const paraNumero = (v: unknown): number => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!s) return NaN;
  // 1.234,56 -> 1234.56 ; 1234.56 mantém
  const br = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(br);
};

export function ImportarItensDialog({
  open, onOpenChange, onConfirmar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmar: (itens: ItemImportado[]) => void;
}) {
  const [colunas, setColunas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Record<string, unknown>[]>([]);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  const limpar = () => { setColunas([]); setLinhas([]); setMapa({}); setErroArquivo(null); };

  const lerArquivo = async (file: File) => {
    limpar();
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (dados.length === 0) { setErroArquivo("A planilha está vazia."); return; }
      const cols = Object.keys(dados[0]);
      const auto: Record<string, string> = {};
      CAMPOS.forEach((c) => {
        const achou = cols.find((col) => PALPITES[c.chave].some((p) => normalizar(col).includes(normalizar(p))));
        if (achou) auto[c.chave] = achou;
      });
      setColunas(cols);
      setLinhas(dados);
      setMapa(auto);
    } catch {
      setErroArquivo("Não foi possível ler o arquivo. Use Excel (.xlsx) ou CSV.");
    }
  };

  const faltando = CAMPOS.filter((c) => c.obrigatorio && !mapa[c.chave]);

  const convertidos: { itens: ItemImportado[]; erros: string[] } = (() => {
    if (faltando.length > 0) return { itens: [], erros: [] };
    const itens: ItemImportado[] = [];
    const erros: string[] = [];
    linhas.forEach((l, idx) => {
      const descricao = String(l[mapa.descricao] ?? "").trim();
      const qtd = paraNumero(l[mapa.quantidade]);
      const preco = paraNumero(l[mapa.preco_unitario]);
      if (!descricao && !String(l[mapa.quantidade] ?? "").trim()) return; // linha em branco
      if (!descricao) erros.push(`Linha ${idx + 2}: descrição vazia`);
      if (!Number.isFinite(qtd)) erros.push(`Linha ${idx + 2}: quantidade inválida`);
      if (!Number.isFinite(preco)) erros.push(`Linha ${idx + 2}: preço inválido`);
      itens.push({
        descricao,
        unidade: mapa.unidade ? String(l[mapa.unidade] ?? "un").trim() || "un" : "un",
        quantidade: Number.isFinite(qtd) ? qtd : 0,
        preco_unitario: Number.isFinite(preco) ? preco : 0,
        etapa_nome: mapa.etapa_nome ? String(l[mapa.etapa_nome] ?? "").trim() || null : null,
      });
    });
    return { itens, erros };
  })();

  const confirmar = () => {
    if (convertidos.erros.length > 0) {
      toast.error("Corrija a planilha antes de importar — nada foi gravado.");
      return;
    }
    if (convertidos.itens.length === 0) { toast.error("Nenhuma linha para importar."); return; }
    onConfirmar(convertidos.itens);
    limpar();
    onOpenChange(false);
    toast.success(`${convertidos.itens.length} itens importados`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) limpar(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar planilha de itens</DialogTitle>
          <DialogDescription>
            Excel (.xlsx) ou CSV. Confira as colunas reconhecidas antes de importar; ou importa tudo, ou nada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Arquivo</Label>
            <Input type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }} />
          </div>

          {erroArquivo && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {erroArquivo}
            </p>
          )}

          {colunas.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CAMPOS.map((c) => (
                  <div key={c.chave}>
                    <Label className="text-xs">
                      {c.label}{c.obrigatorio && <span className="text-destructive"> *</span>}
                    </Label>
                    <Select value={mapa[c.chave] ?? "__none__"}
                      onValueChange={(v) => setMapa({ ...mapa, [c.chave]: v === "__none__" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Não usar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Não usar</SelectItem>
                        {colunas.map((col) => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {faltando.length > 0 ? (
                <p className="text-sm text-destructive">
                  Indique a coluna de: {faltando.map((f) => f.label).join(", ")}.
                </p>
              ) : (
                <>
                  {convertidos.erros.length > 0 && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                      <p className="mb-1 flex items-center gap-2 text-sm font-medium text-destructive">
                        <AlertTriangle className="h-4 w-4" /> {convertidos.erros.length} problema(s) encontrado(s)
                      </p>
                      <ul className="max-h-32 list-disc overflow-y-auto pl-5 text-xs text-destructive">
                        {convertidos.erros.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Un.</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Preço un.</TableHead>
                          <TableHead>Etapa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {convertidos.itens.slice(0, 50).map((i, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="max-w-[260px] truncate">{i.descricao}</TableCell>
                            <TableCell>{i.unidade}</TableCell>
                            <TableCell className="text-right">{i.quantidade}</TableCell>
                            <TableCell className="text-right">{i.preco_unitario}</TableCell>
                            <TableCell>{i.etapa_nome ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {convertidos.itens.length} linha(s) prontas{convertidos.itens.length > 50 ? " (mostrando as 50 primeiras)" : ""}.
                  </p>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={faltando.length > 0 || convertidos.erros.length > 0 || convertidos.itens.length === 0}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
