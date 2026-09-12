import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useSalvarConfig } from "@/components/configuracoes/ConfigFiscalCards";
import { useObraConfig } from "@/hooks/useObraConfig";

export function ConfigEstoqueCard() {
  const { config, isLoading } = useEmpresaConfig();
  const { salvar, salvando } = useSalvarConfig();
  const { rotulos } = useObraConfig();
  const [usa, setUsa] = useState(config.usa_estoque);
  useEffect(() => { setUsa(config.usa_estoque); }, [config.usa_estoque]);
  if (isLoading) return null;

  const obra = rotulos.obra_singular.toLowerCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estoque</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div>
            <Label className="text-sm font-medium">Usar controle de estoque</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Com o estoque ligado, o material recebido de uma compra entra no depósito e só vira custo da {obra}{" "}
              quando sai do depósito para ela, pelo custo médio. Isso muda o resultado: material comprado e parado no
              depósito deixa de aparecer como custo no DRE da {obra} e passa a ser um bem em estoque.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Com o estoque desligado, o custo entra na {obra} já no recebimento da compra.
            </p>
          </div>
          <Switch checked={usa} onCheckedChange={setUsa} />
        </div>
        <p className="text-xs text-muted-foreground">
          Trocar esta opção não altera nenhum lançamento já feito — vale só para o que acontecer daqui para a frente.
        </p>
        <Button disabled={salvando} onClick={() => salvar({ usa_estoque: usa })}>
          Salvar estoque
        </Button>
      </CardContent>
    </Card>
  );
}
