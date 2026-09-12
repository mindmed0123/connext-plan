import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RdoForm } from "@/components/diario/RdoForm";

export default function CampoRdo() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/campo")} className="-ml-2">
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>
      <h1 className="text-2xl font-bold">Novo diário de obra</h1>
      <RdoForm compacto onSalvo={() => navigate("/campo")} />
    </div>
  );
}
