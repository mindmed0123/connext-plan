import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type PortalData = {
  erro?: string;
  obra?: { codigo: string; descricao: string | null; endereco: string | null; status: string; data_recebimento: string | null; responsavel: string | null };
  empresa?: { nome: string; logo_url: string | null };
  etapas?: { nome: string; ordem: number }[];
  cronograma?: { mes: string; percentual_previsto: number | null }[];
  fotos?: { url: string | null; tipo: string; observacao: string | null; data: string }[];
  medicoes?: { numero: number; referencia: string | null; data: string; percentual: number | null }[];
  documentos?: { nome: string; tipo: string | null; url: string | null; data: string }[];
};

const dataBR = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");

export default function PortalObra() {
  const { token } = useParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/portal-obra`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ erro: "invalido" }))
      .finally(() => setCarregando(false));
  }, [token]);

  useEffect(() => {
    document.title = data?.obra ? `Acompanhamento da obra ${data.obra.codigo}` : "Acompanhamento de obra";
  }, [data]);

  // Link privado do cliente: nunca deve ser indexado por buscadores.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.erro || !data.obra) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data?.erro === "expirado"
              ? "Este link de acompanhamento expirou. Peça um novo para a construtora."
              : "Este link não é válido ou foi desativado."}
          </p>
        </div>
      </div>
    );
  }

  const { obra, empresa } = data;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8">
      <header className="flex items-center gap-4">
        {empresa?.logo_url && <img src={empresa.logo_url} alt={empresa.nome} className="h-12 w-auto" />}
        <div>
          <p className="text-sm text-muted-foreground">{empresa?.nome}</p>
          <h1 className="text-2xl font-bold">Acompanhamento da obra {obra.codigo}</h1>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados da obra</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Serviço: </span>{obra.descricao ?? "—"}</p>
          <p><span className="text-muted-foreground">Endereço: </span>{obra.endereco ?? "—"}</p>
          <p><span className="text-muted-foreground">Situação: </span><Badge variant="secondary">{obra.status}</Badge></p>
          <p><span className="text-muted-foreground">Início: </span>{dataBR(obra.data_recebimento)}</p>
          <p><span className="text-muted-foreground">Responsável: </span>{obra.responsavel ?? "—"}</p>
        </CardContent>
      </Card>

      {(data.etapas?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Etapas</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.etapas!.map((e) => <p key={e.nome}>• {e.nome}</p>)}
          </CardContent>
        </Card>
      )}

      {(data.cronograma?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cronograma previsto</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.cronograma!.map((c, i) => (
              <div key={i} className="flex justify-between border-b py-1 last:border-0">
                <span>{new Date(`${c.mes}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                <span>{Number(c.percentual_previsto ?? 0).toFixed(1)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.medicoes?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Medições aprovadas</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.medicoes!.map((m) => (
              <div key={m.numero} className="flex justify-between border-b py-1 last:border-0">
                <span>Medição {m.numero}{m.referencia ? ` — ${m.referencia}` : ""}</span>
                <span>{dataBR(m.data)} • {Number(m.percentual ?? 0).toFixed(1)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.fotos?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.fotos!.filter((f) => f.url).map((f, i) => (
                <a key={i} href={f.url!} target="_blank" rel="noreferrer">
                  <img
                    src={f.url!}
                    alt={f.observacao || `Foto da obra ${obra.codigo}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-md object-cover"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(data.documentos?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.documentos!.map((d, i) => (
              <div key={i} className="flex justify-between border-b py-1 last:border-0">
                <span>{d.nome}</span>
                {d.url && <a className="text-primary underline" href={d.url} target="_blank" rel="noreferrer">Abrir</a>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <footer className="pb-8 pt-4 text-center text-xs text-muted-foreground">
        Acompanhamento fornecido por {empresa?.nome}.
      </footer>
    </div>
  );
}
