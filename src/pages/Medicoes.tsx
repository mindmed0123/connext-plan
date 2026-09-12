import { MedicoesPanel } from "@/components/medicoes/MedicoesPanel";

export default function Medicoes() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Medições</h1>
        <p className="text-sm text-muted-foreground">Boletins de medição dos contratos de cliente</p>
      </div>
      <MedicoesPanel />
    </div>
  );
}
