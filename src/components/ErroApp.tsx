import { Component, type ReactNode } from "react";
import { registrarIncidente } from "@/lib/monitoring";

type Props = { children: ReactNode };
type State = { codigo: string | null };

/** Evita a tela branca: mostra um aviso simples com o código do incidente. */
export class ErroApp extends Component<Props, State> {
  state: State = { codigo: null };

  static getDerivedStateFromError() {
    return { codigo: "..." };
  }

  componentDidCatch(erro: Error) {
    this.setState({ codigo: registrarIncidente(erro, { origem: "tela" }) });
  }

  render() {
    if (!this.state.codigo) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold">Algo deu errado nesta tela</h1>
          <p className="text-sm text-muted-foreground">
            Já avisamos a equipe. Você pode recarregar e continuar de onde parou; nada do que foi salvo se
            perdeu.
          </p>
          <p className="text-xs text-muted-foreground">
            Código do incidente: <span className="font-mono">{this.state.codigo}</span>
          </p>
          <div className="flex justify-center gap-2">
            <button
              className="rounded-md border px-4 py-2 text-sm"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => (window.location.href = "/dashboard")}
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }
}
