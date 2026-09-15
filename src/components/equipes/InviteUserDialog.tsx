import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePerfis } from "@/hooks/usePerfis";
import { toast } from "sonner";

export function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState("operacional");
  const [perfilId, setPerfilId] = useState<string>("nenhum");
  const { perfis } = usePerfis();
  const [busy, setBusy] = useState(false);

  const handleInvite = async () => {
    if (!email) return toast.error("Informe o e-mail");
    setBusy(true);
    let payload: any = null;
    let fnError: any = null;
    try {
      const res = await supabase.functions.invoke("invite-user", {
        body: { email, nome, role, perfil_id: perfilId === "nenhum" ? null : perfilId },
      });
      payload = res.data;
      fnError = res.error;
      // funções do Supabase não devolvem o corpo em respostas de erro: lemos direto
      if (fnError && typeof fnError.context?.json === "function") {
        payload = await fnError.context.json().catch(() => null);
      }
    } catch (e: any) {
      fnError = e;
    }
    setBusy(false);

    if (payload?.error || (fnError && !payload?.ok)) {
      toast.error(payload?.error ?? fnError?.message ?? "Erro ao convidar");
      return;
    }
    toast.success(payload?.message ?? `Convite enviado para ${email}`);
    setEmail("");
    setNome("");
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>O convidado receberá um e-mail para definir a senha.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome (opcional)</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="engenheiro">Engenheiro</SelectItem>
                <SelectItem value="operacional">Operacional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Perfil de permissão</Label>
            <Select value={perfilId} onValueChange={setPerfilId}>
              <SelectTrigger><SelectValue placeholder="Sem perfil" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem perfil</SelectItem>
                {perfis.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleInvite} disabled={busy}>{busy ? "Enviando..." : "Enviar convite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
