import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useEtapas, useItensOrcamento, lerUltimaEtapa, salvarUltimaEtapa } from "@/hooks/useEtapas";

const NENHUM = "__none__";

/**
 * Seletor opcional de etapa da obra (e item do orçamento).
 * Lembra a última etapa usada naquela obra para agilizar o lançamento.
 */
export function EtapaItemSelect({
  obraId,
  etapaId,
  itemId,
  onChange,
  mostrarItem = true,
  className,
}: {
  obraId?: string | null;
  etapaId?: string | null;
  itemId?: string | null;
  onChange: (v: { etapa_id: string | null; orcamento_item_id: string | null }) => void;
  mostrarItem?: boolean;
  className?: string;
}) {
  const { empresaId } = useAuth();
  const { data: etapas = [] } = useEtapas(obraId);
  const { data: itens = [] } = useItensOrcamento(obraId);

  // Sugere a última etapa usada nesta obra
  useEffect(() => {
    if (!obraId || etapaId) return;
    const ultima = lerUltimaEtapa(empresaId, obraId);
    if (ultima && etapas.some((e) => e.id === ultima)) {
      onChange({ etapa_id: ultima, orcamento_item_id: itemId ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId, etapas.length]);

  if (!obraId) return null;

  const itensDaEtapa = etapaId ? itens.filter((i) => i.etapa_id === etapaId || !i.etapa_id) : itens;

  return (
    <div className={className ?? "grid grid-cols-2 gap-3"}>
      <div>
        <Label>Etapa <span className="text-muted-foreground">(opcional)</span></Label>
        <Select
          value={etapaId ?? NENHUM}
          onValueChange={(v) => {
            const novo = v === NENHUM ? null : v;
            salvarUltimaEtapa(empresaId, obraId, novo);
            onChange({ etapa_id: novo, orcamento_item_id: null });
          }}
        >
          <SelectTrigger><SelectValue placeholder="Sem etapa" /></SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value={NENHUM}>Sem etapa</SelectItem>
            {etapas.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
            ))}
            {etapas.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Cadastre etapas na aba Orçado × Realizado da obra</p>
            )}
          </SelectContent>
        </Select>
      </div>

      {mostrarItem && (
        <div>
          <Label>Item do orçamento <span className="text-muted-foreground">(opcional)</span></Label>
          <Select
            value={itemId ?? NENHUM}
            onValueChange={(v) => onChange({ etapa_id: etapaId ?? null, orcamento_item_id: v === NENHUM ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="Sem item" /></SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value={NENHUM}>Sem item</SelectItem>
              {itensDaEtapa.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.descricao}</SelectItem>
              ))}
              {itensDaEtapa.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum item de orçamento aprovado</p>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
