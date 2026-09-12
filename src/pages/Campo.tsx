import { Link } from "react-router-dom";
import { Camera, ClipboardList, HardHat, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useOnline } from "@/hooks/useOnline";
import { useMinhasObras } from "@/hooks/useMinhasObras";

const atalhos = [
  { to: "/campo/rdo", titulo: "Novo RDO", desc: "Diário do dia", icone: ClipboardList },
  { to: "/campo/foto", titulo: "Nova foto", desc: "Direto da câmera", icone: Camera },
  { to: "/obras", titulo: "Minhas obras", desc: "Obras vinculadas a você", icone: HardHat },
];

export default function Campo() {
  const online = useOnline();
  const { data: obras = [] } = useMinhasObras();

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Canteiro</h1>
        <p className="text-sm text-muted-foreground">Tudo o que o encarregado precisa, em poucos toques.</p>
      </div>

      {!online && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <WifiOff className="h-4 w-4 shrink-0" /> Sem internet. Você pode preencher, mas o envio só sai com sinal.
        </div>
      )}

      <div className="space-y-3">
        {atalhos.map((a) => (
          <Link key={a.to} to={a.to}>
            <Card className="flex items-center gap-4 p-5 active:scale-[0.99]">
              <a.icone className="h-8 w-8 text-primary" />
              <div>
                <p className="text-lg font-semibold">{a.titulo}</p>
                <p className="text-sm text-muted-foreground">{a.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="pt-2">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Obras em andamento</p>
        <div className="space-y-2">
          {obras.slice(0, 8).map((o) => (
            <Link key={o.id} to={`/obras/${o.id}`}>
              <Card className="p-4">
                <p className="font-medium">{o.codigo_chamado}</p>
                <p className="text-sm text-muted-foreground">{o.descricao_servico ?? o.endereco ?? ""}</p>
              </Card>
            </Link>
          ))}
          {obras.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma obra vinculada a você.</p>}
        </div>
      </div>
    </div>
  );
}
