import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createFoodOrder } from "@/lib/food.functions";
import { formatMoney } from "@/lib/remittance";
import { BR_STATES, BR_STATE_STORAGE_KEY, stateName } from "@/lib/br-states";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import {
  UtensilsCrossed, MapPin, Store, ShoppingCart, X, Plus, Minus, Trash2,
  Loader2, Check, User, Phone, Home, ChefHat, Clock,
} from "lucide-react";

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  br_state: string;
  city: string;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  delivery_notes: string | null;
};

type FoodItem = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price_brl: number;
  image_url: string | null;
  available: boolean;
};

type Line = { id: string; title: string; price_brl: number; qty: number };

/** VipComida: restaurantes cubanos en Brasil filtrados por estado y ciudad. */
export function FoodCatalog({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const submitOrder = useServerFn(createFoodOrder);

  const [state, setState] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(BR_STATE_STORAGE_KEY);
    if (saved) setState(saved);
  }, []);
  useEffect(() => {
    if (state) localStorage.setItem(BR_STATE_STORAGE_KEY, state);
  }, [state]);

  const restaurants = useQuery<Restaurant[]>({
    queryKey: ["food-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id,name,description,image_url,br_state,city,neighborhood,phone,whatsapp,delivery_notes")
        .eq("approved", true)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Restaurant[];
    },
  });

  const cities = useMemo(() => {
    const list = (restaurants.data ?? []).filter((r) => !state || r.br_state === state);
    return Array.from(new Set(list.map((r) => r.city))).sort();
  }, [restaurants.data, state]);

  const visible = useMemo(
    () =>
      (restaurants.data ?? []).filter(
        (r) => (!state || r.br_state === state) && (!city || r.city === city),
      ),
    [restaurants.data, state, city],
  );

  const menu = useQuery<FoodItem[]>({
    queryKey: ["food-menu", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_items")
        .select("id,category,title,description,price_brl,image_url,available")
        .eq("restaurant_id", openId!)
        .eq("available", true)
        .order("sort_order")
        .order("title");
      if (error) throw error;
      return (data ?? []).map((i) => ({ ...i, price_brl: Number(i.price_brl) })) as FoodItem[];
    },
  });

  const myOrders = useQuery({
    queryKey: ["food-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = cart.reduce((s, l) => s + l.price_brl * l.qty, 0);
  const openRestaurant = visible.find((r) => r.id === openId) ?? null;

  function addLine(item: FoodItem) {
    setCart((prev) => {
      const found = prev.find((l) => l.id === item.id);
      if (found) return prev.map((l) => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { id: item.id, title: item.title, price_brl: item.price_brl, qty: 1 }];
    });
    toast.success(`${item.title} añadido`);
  }

  const send = useMutation({
    mutationFn: async () => {
      if (!openId) throw new Error("Elige un restaurante");
      if (cart.length === 0) throw new Error("Tu carrito está vacío");
      if (name.trim().length < 2) throw new Error("Escribe tu nombre completo");
      if (phone.trim().length < 6) throw new Error("Escribe tu teléfono en Brasil");
      if (address.trim().length < 8) throw new Error("Escribe tu dirección de entrega");
      return submitOrder({
        data: {
          restaurantId: openId,
          customer: { name: name.trim(), phone: phone.trim(), address: address.trim(), notes: notes.trim() || null },
          items: cart.map((l) => ({ id: l.id, qty: l.qty })),
        },
      });
    },
    onSuccess: (res) => {
      setCart([]);
      setCartOpen(false);
      setCheckout(false);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["food-orders", userId] });
      toast.success(`¡Pedido #${res.orderNo} enviado al restaurante!`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo enviar el pedido"),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, FoodItem[]>();
    (menu.data ?? []).forEach((i) => {
      const arr = map.get(i.category) ?? [];
      arr.push(i);
      map.set(i.category, arr);
    });
    return Array.from(map.entries());
  }, [menu.data]);

  return (
    <div className="space-y-5 pb-4">
      <div className="animate-rise overflow-hidden rounded-2xl bg-gradient-amber p-4 text-white shadow-glow">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/25">
            <UtensilsCrossed className="h-5 w-5 animate-float" />
          </span>
          <div>
            <h1 className="font-display text-xl font-extrabold">VipComida</h1>
            <p className="text-[11px] font-bold text-white/90">Comida cubana en Brasil, cerca de ti</p>
          </div>
        </div>
      </div>

      {/* Filtro por estado y ciudad */}
      <div className="animate-rise grid grid-cols-2 gap-2">
        <label className="rounded-xl border border-border bg-card p-2 text-xs font-bold">
          <span className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
            <MapPin className="h-3 w-3" /> Estado
          </span>
          <select
            value={state}
            onChange={(e) => { setState(e.target.value); setCity(""); setOpenId(null); }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-bold"
          >
            <option value="">Todos</option>
            {BR_STATES.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="rounded-xl border border-border bg-card p-2 text-xs font-bold">
          <span className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
            <Home className="h-3 w-3" /> Ciudad
          </span>
          <select
            value={city}
            onChange={(e) => { setCity(e.target.value); setOpenId(null); }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-bold"
          >
            <option value="">Todas</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Restaurantes */}
      {restaurants.isLoading && (
        <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      )}
      {!restaurants.isLoading && visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs font-bold text-muted-foreground">
          Todavía no hay restaurantes en esta zona. Prueba otro estado o ciudad.
        </p>
      )}

      <div className="space-y-3">
        {visible.map((r, i) => (
          <div
            key={r.id}
            style={{ animationDelay: `${i * 50}ms` }}
            className="animate-rise overflow-hidden rounded-2xl border border-border bg-card shadow-card"
          >
            <button
              onClick={() => setOpenId((v) => (v === r.id ? null : r.id))}
              className="w-full text-left"
            >
              {r.image_url ? (
                <img
                  src={r.image_url}
                  alt={r.name}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/7] w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="grid aspect-[16/7] w-full place-items-center bg-gradient-amber text-white">
                  <ChefHat className="h-8 w-8" />
                </div>
              )}
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-base font-extrabold">{r.name}</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-extrabold text-gold">
                    {r.city} · {stateName(r.br_state)}
                  </span>
                </div>
                {r.description && (
                  <p className="mt-1 text-[11px] font-bold text-muted-foreground">{r.description}</p>
                )}
                {r.neighborhood && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {r.neighborhood}
                  </p>
                )}
              </div>
            </button>

            {openId === r.id && (
              <div className="border-t border-border p-3">
                {menu.isLoading && (
                  <div className="grid place-items-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gold" /></div>
                )}
                {!menu.isLoading && grouped.length === 0 && (
                  <p className="text-center text-xs font-bold text-muted-foreground">
                    Este restaurante todavía no publicó su menú.
                  </p>
                )}
                {grouped.map(([cat, items]) => (
                  <div key={cat} className="mb-3">
                    <p className="mb-1.5 rounded-lg bg-gradient-emerald px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      {cat}
                    </p>
                    <ul className="space-y-2">
                      {items.map((it) => (
                        <li key={it.id} className="flex items-center gap-2 rounded-xl border border-border bg-background p-2">
                          {it.image_url && (
                            <img
                              src={it.image_url}
                              alt={it.title}
                              loading="lazy"
                              decoding="async"
                              className="h-14 w-14 shrink-0 rounded-lg object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-extrabold">{it.title}</p>
                            {it.description && (
                              <p className="truncate text-[11px] font-bold text-muted-foreground">{it.description}</p>
                            )}
                            <p className="text-xs font-extrabold text-gold">{formatMoney(it.price_brl, "BRL")}</p>
                          </div>
                          <button
                            onClick={() => addLine(it)}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-amber text-white shadow-glow transition-transform active:scale-95"
                            aria-label={`Añadir ${it.title}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {r.delivery_notes && (
                  <p className="rounded-xl bg-secondary p-2 text-[11px] font-bold text-muted-foreground">
                    {r.delivery_notes}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mis pedidos */}
      <section className="animate-rise">
        <h2 className="mb-2 flex items-center gap-2 rounded-xl bg-gradient-sky px-3 py-2 text-sm font-extrabold uppercase tracking-wider text-white shadow-glow">
          <Clock className="h-4 w-4" /> Mis pedidos de comida
        </h2>
        {(myOrders.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs font-bold text-muted-foreground">
            Aún no tienes pedidos.
          </p>
        ) : (
          <ul className="space-y-2">
            {myOrders.data?.map((o) => (
              <li key={o.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold">#{o.order_no} · {o.restaurant_name}</p>
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("es")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-base font-extrabold text-gold">
                      {formatMoney(Number(o.total_brl), "BRL")}
                    </p>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Carrito flotante */}
      {cart.length > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-md gap-2 px-5">
          <button
            onClick={() => setCartOpen(true)}
            className="flex flex-1 items-center justify-between rounded-2xl bg-gradient-sky px-4 py-3 text-white shadow-glow transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-2 text-sm font-extrabold">
              <ShoppingCart className="h-4 w-4" /> {cart.reduce((s, l) => s + l.qty, 0)} platos
            </span>
            <span className="font-display text-base font-extrabold">{formatMoney(total, "BRL")}</span>
          </button>
          <button
            onClick={() => { setCartOpen(true); setCheckout(true); }}
            className="rounded-2xl bg-gradient-amber px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-[0.98]"
          >
            Pedir
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
          <button aria-label="Cerrar" onClick={() => setCartOpen(false)} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
          <div className="relative mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-4 shadow-glow">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-base font-extrabold">
                {checkout ? "Datos de entrega" : "Tu pedido"}
              </p>
              <button onClick={() => setCartOpen(false)} aria-label="Cerrar" className="rounded-md p-1 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {openRestaurant && (
              <p className="mb-3 flex items-center gap-1 rounded-xl bg-secondary p-2 text-[11px] font-extrabold text-gold">
                <Store className="h-3.5 w-3.5" /> {openRestaurant.name} · {openRestaurant.city}
              </p>
            )}

            {!checkout ? (
              <>
                <ul className="space-y-2">
                  {cart.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 rounded-xl border border-border bg-background p-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{l.title}</p>
                        <p className="text-xs font-extrabold text-gold">{formatMoney(l.price_brl * l.qty, "BRL")}</p>
                      </div>
                      <button
                        onClick={() => setCart((p) => p.map((x) => (x.id === l.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}
                        className="grid h-8 w-8 place-items-center rounded-full bg-secondary" aria-label="Quitar uno">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-extrabold">{l.qty}</span>
                      <button
                        onClick={() => setCart((p) => p.map((x) => (x.id === l.id ? { ...x, qty: x.qty + 1 } : x)))}
                        className="grid h-8 w-8 place-items-center rounded-full bg-secondary" aria-label="Añadir uno">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setCart((p) => p.filter((x) => x.id !== l.id))}
                        className="grid h-8 w-8 place-items-center rounded-full text-destructive" aria-label="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary p-3">
                  <span className="text-xs font-extrabold uppercase text-muted-foreground">Total</span>
                  <span className="font-display text-lg font-extrabold text-gold">{formatMoney(total, "BRL")}</span>
                </div>
                <button
                  onClick={() => setCheckout(true)}
                  className="mt-3 w-full rounded-xl bg-gradient-amber px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-[0.98]"
                >
                  Continuar
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <Field icon={User} label="Tu nombre" value={name} onChange={setName} placeholder="Nombre y apellido" />
                <Field icon={Phone} label="Teléfono en Brasil" value={phone} onChange={setPhone} placeholder="+55 11 90000-0000" />
                <Field icon={Home} label="Dirección de entrega" value={address} onChange={setAddress} placeholder="Calle, número, barrio" />
                <label className="block">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Notas (opcional)</span>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Sin cebolla, tocar el timbre…"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold"
                  />
                </label>
                <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
                  <span className="text-xs font-extrabold uppercase text-muted-foreground">Total a pagar</span>
                  <span className="font-display text-lg font-extrabold text-gold">{formatMoney(total, "BRL")}</span>
                </div>
                <p className="rounded-xl border border-dashed border-border p-2 text-[11px] font-bold text-muted-foreground">
                  El pago se hace directo al restaurante en la entrega. Te avisamos cuando esté en preparación y cuando salga.
                </p>
                <button
                  onClick={() => send.mutate()}
                  disabled={send.isPending}
                  className="w-full rounded-xl bg-gradient-emerald px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {send.isPending ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><Check className="h-4 w-4" /> Enviar pedido</span>
                  )}
                </button>
                <button onClick={() => setCheckout(false)} className="w-full py-2 text-xs font-extrabold text-muted-foreground">
                  Volver al carrito
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  icon: Icon, label, value, onChange, placeholder,
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold"
      />
    </label>
  );
}
