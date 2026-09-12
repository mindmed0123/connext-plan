import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModulos } from "@/hooks/useModulos";
import { MODULOS, PERFIS, PerfilOperacao, SEMPRE_ATIVOS } from "@/lib/modulos";
import { apagarDadosExemplo, carregarDadosExemplo } from "@/lib/dados-exemplo";

export function ConfigPerfilCard() {
  const { perfil, aplicarPerfil, isLoading } = useModulos();
  const [salvando, setSalvando] = useState<PerfilOperacao | null>(null);

  const trocar = async (novo: PerfilOperacao) => {
    setSalvando(novo);
    try {
      await aplicarPerfil(novo);
      toast.success("Tipo de operação atualizado — rótulos e módulos ajustados.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível trocar o tipo de operação");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tipo de operação</CardTitle>
        <p className="text-xs text-muted-foreground">
          Define os rótulos e quais módulos aparecem no menu. Trocar o tipo <strong>não apaga nenhum dado</strong>.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {PERFIS.map((p) => {
          const ativo = perfil === p.valor;
          return (
            <div
              key={p.valor}
              className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                ativo ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div>
                <p className="text-sm font-medium">{p.titulo}</p>
                <p className="text-xs text-muted-foreground">{p.descricao}</p>
              </div>
              <Button
                size="sm"
                variant={ativo ? "secondary" : "outline"}
                disabled={ativo || isLoading || !!salvando}
                onClick={() => trocar(p.valor)}
              >
                {salvando === p.valor ? <Loader2 className="h-4 w-4 animate-spin" /> : ativo ? "Em uso" : "Usar este"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ConfigModulosCard() {
  const { moduloAtivo, setModulo, isLoading } = useModulos();
  const [mudando, setMudando] = useState<string | null>(null);

  const alternar = async (chave: any, valor: boolean) => {
    setMudando(chave);
    try {
      await setModulo(chave, valor);
      toast.success(valor ? "Módulo ativado" : "Módulo desligado — os dados continuam guardados");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível alterar o módulo");
    } finally {
      setMudando(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ativar módulos</CardTitle>
        <p className="text-xs text-muted-foreground">
          Módulo desligado some do menu, mas nada é apagado: ao religar, tudo volta.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {MODULOS.map((m) => {
          const fixo = SEMPRE_ATIVOS.includes(m.chave);
          return (
            <div key={m.chave} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{m.nome}</p>
                <p className="text-xs text-muted-foreground">{m.descricao}</p>
              </div>
              <Switch
                checked={moduloAtivo(m.chave)}
                disabled={fixo || isLoading || mudando === m.chave}
                onCheckedChange={(v) => alternar(m.chave, v)}
                aria-label={m.nome}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ConfigDadosExemploCard() {
  const { empresaId } = useAuth();
  const { perfil } = useModulos();
  const qc = useQueryClient();
  const [carregando, setCarregando] = useState(false);
  const [apagando, setApagando] = useState(false);

  const carregar = async () => {
    if (!empresaId) return;
    setCarregando(true);
    try {
      const r = await carregarDadosExemplo(empresaId, perfil);
      qc.invalidateQueries();
      if (r.falhas.length) {
        toast.warning(`Exemplo criado com ressalvas: ${r.falhas.join(" · ")}`);
      } else {
        toast.success(`Dados de exemplo prontos: ${r.criados.join(", ")}.`);
      }
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível criar os dados de exemplo");
    } finally {
      setCarregando(false);
    }
  };

  const apagar = async () => {
    if (!empresaId) return;
    if (!confirm("Apagar todos os dados marcados como exemplo? Seus dados reais não são tocados.")) return;
    setApagando(true);
    try {
      const r = await apagarDadosExemplo(empresaId);
      qc.invalidateQueries();
      if (r.obras === 0) toast.info("Não há dados de exemplo para apagar.");
      else if (r.falhas.length) toast.warning(`Apagado com ressalvas: ${r.falhas.join(" · ")}`);
      else toast.success("Dados de exemplo apagados.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível apagar os dados de exemplo");
    } finally {
      setApagando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados de exemplo</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cria uma obra completa do seu tipo de operação para demonstrar o sistema cheio. Tudo fica marcado como
          exemplo e sai de uma vez.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={carregar} disabled={carregando || apagando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Carregar dados de exemplo
          </Button>
          <Button variant="outline" onClick={apagar} disabled={carregando || apagando}>
            {apagando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Apagar dados de exemplo
          </Button>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Os registros de exemplo começam com [EXEMPLO] no nome, para ninguém confundir com obra de verdade.
        </p>
      </CardContent>
    </Card>
  );
}
