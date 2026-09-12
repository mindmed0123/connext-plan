import { MedicoesPanel } from "@/components/medicoes/MedicoesPanel";

export function MedicoesTab({ obraId }: { obraId: string }) {
  return <MedicoesPanel obraId={obraId} />;
}
