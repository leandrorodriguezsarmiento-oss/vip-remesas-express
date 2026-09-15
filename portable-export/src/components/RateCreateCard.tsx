import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { createRateAsAdmin } from "@/lib/rates.functions";

export function RateCreateCard() {
  const qc = useQueryClient();
  const create = useServerFn(createRateAsAdmin);
  const [originCountry, setOriginCountry] = useState("MX");
  const [originCurrency, setOriginCurrency] = useState("MXN");
  const [method, setMethod] = useState("transferencia");
  const [destCurrency, setDestCurrency] = useState("MLC");
  const [rate, setRate] = useState("1");
  const [minAmount, setMinAmount] = useState("1");
  const [tMin, setTMin] = useState("15");
  const [tMax, setTMax] = useState("60");
  const [active, setActive] = useState(true);

  const mutation = useMutation({
    mutationFn: () => create({ data: {
      origin_country: originCountry,
      origin_currency: originCurrency,
      method_category: method,
      dest_currency: destCurrency,
      rate: Number(rate),
      time_min_minutes: Number(tMin),
      time_max_minutes: Number(tMax),
      min_amount: Number(minAmount),
      active,
    }}),
    onSuccess: () => {
      toast.success("Tasa creada");
      qc.invalidateQueries({ queryKey: ["admin-rates"] });
      qc.invalidateQueries({ queryKey: ["rates"] });
      setRate("1");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear la tasa"),
  });

  const input = "w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-gold";
  return (
    <div className="rounded-xl border border-gold/40 bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-gold text-primary-foreground"><Plus className="h-4 w-4" /></div>
        <div><p className="text-sm font-bold">Agregar nueva tasa</p><p className="text-[10px] text-muted-foreground">No necesitas modificar el código.</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <label className="text-[10px] text-muted-foreground">País<input className={input} value={originCountry} onChange={e=>setOriginCountry(e.target.value)} placeholder="MX" /></label>
        <label className="text-[10px] text-muted-foreground">Moneda origen<input className={input} value={originCurrency} onChange={e=>setOriginCurrency(e.target.value)} placeholder="MXN" /></label>
        <label className="text-[10px] text-muted-foreground">Método<input className={input} value={method} onChange={e=>setMethod(e.target.value)} placeholder="transferencia" /></label>
        <label className="text-[10px] text-muted-foreground">Moneda destino<input className={input} value={destCurrency} onChange={e=>setDestCurrency(e.target.value)} placeholder="MLC" /></label>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <label className="text-[10px] text-muted-foreground">Tasa<input className={input} type="number" step="0.0001" value={rate} onChange={e=>setRate(e.target.value)} /></label>
        <label className="text-[10px] text-muted-foreground">Monto mínimo<input className={input} type="number" value={minAmount} onChange={e=>setMinAmount(e.target.value)} /></label>
        <label className="text-[10px] text-muted-foreground">Tiempo mín. (min)<input className={input} type="number" value={tMin} onChange={e=>setTMin(e.target.value)} /></label>
        <label className="text-[10px] text-muted-foreground">Tiempo máx. (min)<input className={input} type="number" value={tMax} onChange={e=>setTMax(e.target.value)} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} className="h-4 w-4" /> Activa</label>
        <button disabled={mutation.isPending} onClick={()=>mutation.mutate()} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-bold text-primary-foreground shadow-gold disabled:opacity-60"><Check className="h-3 w-3" /> {mutation.isPending ? "Guardando…" : "Crear tasa"}</button>
      </div>
    </div>
  );
}
