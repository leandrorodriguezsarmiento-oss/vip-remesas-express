import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/delete-account.functions";

export function DeleteAccountCard() {
  const [confirm, setConfirm] = useState("");
  const remove = useServerFn(deleteMyAccount);
  const mutation = useMutation({
    mutationFn: () => remove(),
    onSuccess: async () => {
      await supabase.auth.signOut();
      window.location.href = "/auth/login";
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar la cuenta"),
  });

  const allowed = confirm.trim().toUpperCase() === "ELIMINAR";

  return (
    <section className="rounded-2xl border border-red-500/30 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-red-500"><Trash2 className="h-5 w-5" /></span>
        <h2 className="font-display text-base font-bold">Eliminar mi cuenta</h2>
      </div>
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        Esta acción elimina tu cuenta de VIP Remesas y no se puede deshacer.
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder='Escribe "ELIMINAR" para confirmar'
        className="mb-3 w-full rounded-lg border border-red-500/30 bg-background px-3 py-2.5 text-sm outline-none focus:border-red-500"
      />
      <button
        type="button"
        disabled={!allowed || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Eliminar cuenta definitivamente
      </button>
    </section>
  );
}
