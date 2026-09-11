import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "valid" | "invalid" | "already" | "success" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON },
        });
        const j = await r.json();
        if (j.valid) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setSubmitting(false);
    if (error) setState("error");
    else if ((data as any)?.success) setState("success");
    else if ((data as any)?.reason === "already_unsubscribed") setState("already");
    else setState("error");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Cancelar inscrição</CardTitle>
          <CardDescription>Gestão de Obra — e-mails do app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Validando...</div>}
          {state === "valid" && (
            <>
              <p>Tem certeza que deseja parar de receber e-mails do Gestão de Obra?</p>
              <Button onClick={confirm} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cancelamento"}
              </Button>
            </>
          )}
          {state === "success" && <p className="flex items-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" /> Cancelamento confirmado. Você não receberá mais e-mails.</p>}
          {state === "already" && <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-5 w-5" /> Você já havia cancelado a inscrição.</p>}
          {state === "invalid" && <p className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Link inválido ou expirado.</p>}
          {state === "error" && <p className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Algo deu errado. Tente novamente mais tarde.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
