import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, generatePixCode } from "@/lib/remittance";
import { PixQrCode } from "@/components/PixQrCode";
import { toast } from "sonner";
import {
  ShoppingBag, Store, ShoppingCart, X, Plus, Minus, Trash2, Loader2, Check,
  User, Phone, IdCard, MapPin, Plane, Copy,
} from "lucide-react";
import catCelulares from "@/assets/cat-celulares.jpg";
import catElectro from "@/assets/cat-electrodomesticos.jpg";
import catAlimentos from "@/assets/cat-alimentos.jpg";
import mapRoute from "@/assets/map-route.jpg";
import { FlagIcon } from "@/components/FlagIcon";
import { CUBA_PROVINCES, PROVINCE_STORAGE_KEY } from "@/lib/provinces";


export type StoreProduct = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price_brl: number;
  images: string[];
  province: string | null;
};


export const STORE_CATEGORIES = [
  { id: "celulares", label: "Celulares, tablets y accesorios", photo: catCelulares, grad: "bg-gradient-sky" },
  { id: "electrodomesticos", label: "Electrodomésticos", photo: catElectro, grad: "bg-gradient-violet" },
  { id: "alimentos", label: "Alimentos y combos", photo: catAlimentos, grad: "bg-gradient-emerald" },
] as const;

const CART_KEY = "vipshop-cart-v1";

type CartLine = { id: string; title: string; price_brl: number; image: string | null; qty: number; province?: string | null };

export function VipShopLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-amber text-white shadow-glow animate-float">
        <Store className="h-6 w-6" />
      </span>
      <span className="font-display text-2xl font-extrabold tracking-tight">
        Vip<span className="text-gradient-gold">Shop</span> Brasil
      </span>
    </div>
  );
}

/** Animación de "tiendita que se abre" + avión que vuela de Brasil a Cuba. */
function ShopOpening() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 animate-shutter bg-gradient-amber">
        <img src={mapRoute} alt="" aria-hidden width={1024} height={640}
          className="absolute inset-0 h-full w-full animate-zoom-bg object-cover opacity-35" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-x-0 bottom-0 h-3 bg-black/25" />
        <div className="relative grid h-full place-items-center">
          <div className="animate-pop text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-white/20 animate-float">
              <Store className="h-10 w-10 text-white" />
            </span>
            <p className="mt-3 font-display text-2xl font-extrabold text-white">VipShop Brasil</p>
            <p className="text-xs font-bold text-white/90">Abriendo la tienda…</p>

            {/* Ruta Brasil → Cuba (banderas reales sobre el mapa) */}
            <div className="relative mx-auto mt-6 flex w-64 items-center justify-between">
              <FlagIcon code="BR" className="relative z-10 h-8 w-11 animate-float rounded-md shadow-glow" />
              <svg viewBox="0 0 240 40" className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 w-full" aria-hidden>
                <path d="M12 28 C 70 -6, 170 -6, 228 28" fill="none" stroke="white" strokeOpacity="0.75"
                  strokeWidth="2" strokeLinecap="round" className="animate-dash" />
              </svg>
              <FlagIcon code="CU" className="relative z-10 h-8 w-11 animate-float rounded-md shadow-glow" />
              <span className="animate-fly absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <Plane className="h-7 w-7 text-white drop-shadow" />
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}


function Field({
  label, icon: Icon, value, onChange, placeholder, hint,
}: {
  label: string;
  icon: typeof User;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block animate-rise">
      <span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold outline-none transition focus:border-gold"
      />
      {hint && <span className="mt-1 block text-[10px] font-bold text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function StoreCatalog() {
  const qc = useQueryClient();
  const [cat, setCat] = useState<string>(STORE_CATEGORIES[0].id);
  const [province, setProvince] = useState("");
  const [open, setOpen] = useState<StoreProduct | null>(null);
  const [opening, setOpening] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  // Pago primero: no se crea el pedido hasta que el cliente confirma el PIX.
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  // datos de quien recibe en Cuba
  const [rName, setRName] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rCard, setRCard] = useState("");
  const [rAddress, setRAddress] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setOpening(false), 1100);
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw) as CartLine[]);
      const saved = localStorage.getItem(PROVINCE_STORAGE_KEY);
      if (saved) setProvince(saved);
    } catch {
      /* carrito vacío */
    }
    // Si el perfil ya tiene provincia, esa manda.
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("profiles").select("province").eq("id", auth.user.id).maybeSingle();
      const p = (data as { province?: string | null } | null)?.province;
      if (p) setProvince(p);
    })();
    return () => clearTimeout(t);
  }, []);

  const changeProvince = (v: string) => {
    setProvince(v);
    try { localStorage.setItem(PROVINCE_STORAGE_KEY, v); } catch { /* sin almacenamiento */ }
  };


  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* sin almacenamiento */
    }
  }, [cart]);

  const q = useQuery<StoreProduct[]>({
    queryKey: ["store-products"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("id, category, title, description, price_brl, images, province")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        price_brl: Number(p.price_brl),
        images: (p.images ?? []) as string[],
      })) as StoreProduct[];
    },
  });

  const items = (q.data ?? []).filter(
    (p) => p.category === cat && (!province || !p.province || p.province === province),
  );

  const count = cart.reduce((s, l) => s + l.qty, 0);
  const total = useMemo(() => cart.reduce((s, l) => s + l.qty * l.price_brl, 0), [cart]);

  function addToCart(p: StoreProduct) {
    setCart((prev) => {
      const found = prev.find((l) => l.id === p.id);
      if (found) return prev.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { id: p.id, title: p.title, price_brl: p.price_brl, image: p.images[0] ?? null, qty: 1, province: p.province }];
    });
    toast.success(`${p.title} agregado al carrito`);
  }

  const setQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );

  /** Valida los datos de quien recibe; lanza con el primer error encontrado. */
  function validateRecipient() {
    const name = rName.trim();
    const phone = rPhone.replace(/\D/g, "");
    const card = rCard.replace(/\D/g, "");
    const address = rAddress.trim();
    if (cart.length === 0) throw new Error("Tu carrito está vacío");
    if (name.length < 5 || !/^[A-Za-zÀ-ÿ\s.']+$/.test(name)) throw new Error("Escribe el nombre completo (solo letras)");
    if (phone.length !== 8) throw new Error("El teléfono en Cuba debe tener 8 dígitos");
    if (card.length !== 11) throw new Error("El carnet de identidad debe tener 11 dígitos");
    if (address.length < 10) throw new Error("Escribe la dirección completa de entrega");
    return { name, phone, card, address };
  }

  function goToPayment() {
    try {
      validateRecipient();
      setPaid(false);
      setPaying(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revisa los datos");
    }
  }

  // PIX copia y pega con el total del carrito ya embebido.
  const pixCode = useMemo(
    () => (total > 0 ? generatePixCode(`vipshop-${cart.length}`, total) : null),
    [total, cart.length],
  );

  const submit = useMutation({
    mutationFn: async () => {
      const { name, phone, card, address } = validateRecipient();
      if (!paid) throw new Error("Confirma primero el pago por PIX");

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Inicia sesión para pedir");

      const { data, error } = await supabase
        .from("store_orders")
        .insert({
          user_id: uid,
          recipient_name: name,
          recipient_phone: `+53${phone}`,
          recipient_id_card: card,
          recipient_address: address,
          items: cart.map((l) => ({ id: l.id, title: l.title, qty: l.qty, price_brl: l.price_brl, province: l.province ?? null })),
          total_brl: total,
        })
        .select("order_no")
        .single();
      if (error) throw error;
      return data.order_no as number;
    },
    onSuccess: (orderNo) => {
      setCart([]);
      setCheckout(false);
      setPaying(false);
      setPaid(false);
      setCartOpen(false);
      setRName(""); setRPhone(""); setRCard(""); setRAddress("");

      qc.invalidateQueries({ queryKey: ["store-orders"] });
      toast.success(`¡Pedido #${orderNo} recibido! Te avisamos cuando esté listo.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo enviar el pedido"),
  });

  return (
    <div className="space-y-4">
      {opening && <ShopOpening />}

      <div className="flex items-center justify-between gap-2">
        <VipShopLogo className="animate-rise" />
        <button
          onClick={() => setCartOpen(true)}
          aria-label="Ver carrito"
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-sky text-white shadow-glow transition-transform active:scale-95"
        >
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="animate-pop absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-extrabold text-white">
              {count}
            </span>
          )}
        </button>
      </div>

      <p className="text-sm font-bold text-muted-foreground">
        Elige lo que quieres enviarle a tu familia en Cuba. Nosotros lo entregamos.
      </p>

      <label className="animate-rise block rounded-2xl border border-gold/30 bg-card p-3 shadow-card">
        <span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3 w-3 text-gold" /> Provincia de entrega en Cuba
        </span>
        <select
          value={province}
          onChange={(e) => changeProvince(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-extrabold outline-none transition focus:border-gold"
        >
          <option value="">Todas las provincias</option>
          {CUBA_PROVINCES.map((pr) => (
            <option key={pr} value={pr}>{pr}</option>
          ))}
        </select>
        <span className="mt-1 block text-[10px] font-bold text-muted-foreground">
          Verás primero los artículos disponibles en esa provincia.
        </span>
      </label>

      <div className="grid grid-cols-3 gap-2">
        {STORE_CATEGORIES.map(({ id, label, photo, grad }, i) => (
          <button
            key={id}
            onClick={() => setCat(id)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`animate-rise overflow-hidden rounded-2xl border text-center transition active:scale-[0.97] ${
              cat === id ? "border-gold shadow-glow" : "border-border"
            }`}
          >
            <span className={`relative block aspect-square w-full ${grad}`}>
              <img
                src={photo}
                alt={label}
                loading="lazy"
                width={512}
                height={512}
                className="h-full w-full object-cover"
              />
              {cat === id && (
                <span className="animate-pop absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </span>
            <span className="block bg-card px-1 py-2 text-[10px] font-extrabold uppercase leading-tight">
              {label}
            </span>
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm font-bold text-muted-foreground">Cargando productos…</p>}
      {!q.isLoading && items.length === 0 && (
        <p className="animate-rise rounded-xl border border-border bg-card p-4 text-sm font-bold text-muted-foreground">
          Pronto publicaremos productos en esta categoría.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {items.map((p, i) => (
          <div
            key={p.id}
            style={{ animationDelay: `${i * 40}ms` }}
            className="animate-rise overflow-hidden rounded-2xl border border-border bg-card text-left shadow-card transition-transform hover:border-gold"
          >
            <button onClick={() => setOpen(p)} className="block w-full text-left">
              <div className="aspect-square w-full bg-secondary">
                {p.images[0] ? (
                  <img src={p.images[0]} alt={p.title} loading="lazy" decoding="async" width={512} height={512} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="px-3 pt-3">
                <p className="text-sm font-extrabold leading-tight">{p.title}</p>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-[11px] font-bold text-muted-foreground">{p.description}</p>
                )}
                <p className="mt-1 font-display text-base font-extrabold text-gold">
                  {formatMoney(p.price_brl, "BRL")}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-extrabold text-foreground/80">
                  <MapPin className="h-3 w-3 text-gold" /> {p.province ?? "Toda Cuba"}
                </span>
              </div>
            </button>
            <div className="p-3 pt-2">
              <button
                onClick={() => addToCart(p)}
                className="flex w-full items-center justify-center gap-1 rounded-xl bg-gradient-amber px-2 py-2 text-[11px] font-extrabold text-white shadow-glow transition-transform active:scale-95"
              >
                <ShoppingCart className="h-3.5 w-3.5" /> Agregar al carrito
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detalle de producto */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/60 p-0 sm:items-center sm:p-6">
          <div className="animate-rise max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-gold/40 bg-card p-4 sm:mx-auto sm:max-w-md sm:rounded-2xl">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-display text-lg font-extrabold">{open.title}</p>
              <button onClick={() => setOpen(null)} aria-label="Cerrar" className="rounded-md p-1 text-muted-foreground hover:text-gold">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {open.images.map((src) => (
                <img key={src} src={src} alt={open.title} loading="lazy" decoding="async" width={320} height={320} className="h-40 w-40 shrink-0 rounded-xl object-cover" />
              ))}
            </div>
            {open.description && (
              <p className="mt-3 whitespace-pre-line text-sm font-bold text-foreground/80">{open.description}</p>
            )}
            <p className="mt-3 font-display text-2xl font-extrabold text-gold">
              {formatMoney(open.price_brl, "BRL")}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-extrabold">
              <MapPin className="h-3 w-3 text-gold" /> {open.province ?? "Toda Cuba"}
            </p>
            <button
              onClick={() => { addToCart(open); setOpen(null); }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-amber px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-95"
            >
              <ShoppingCart className="h-4 w-4" /> Agregar al carrito
            </button>
          </div>
        </div>
      )}

      {/* Carrito */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/60 sm:items-center sm:p-6">
          <div className="animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-gold/40 bg-card p-4 sm:mx-auto sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg font-extrabold">
                {checkout ? "Datos de quien recibe" : "Tu carrito"}
              </p>
              <button onClick={() => { setCartOpen(false); setCheckout(false); }} aria-label="Cerrar" className="rounded-md p-1 text-muted-foreground hover:text-gold">
                <X className="h-5 w-5" />
              </button>
            </div>

            {cart.length === 0 && (
              <p className="rounded-xl border border-border bg-background p-4 text-sm font-bold text-muted-foreground">
                Aún no agregaste productos.
              </p>
            )}

            {!checkout && cart.map((l, i) => (
              <div
                key={l.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className="animate-rise mb-2 flex items-center gap-3 rounded-xl border border-border bg-background p-2"
              >
                {l.image ? (
                  <img src={l.image} alt={l.title} loading="lazy" decoding="async" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-lg bg-secondary">
                    <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{l.title}</p>
                  <p className="text-xs font-extrabold text-gold">{formatMoney(l.price_brl * l.qty, "BRL")}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(l.id, -1)} aria-label="Quitar uno" className="grid h-7 w-7 place-items-center rounded-lg border border-border">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-extrabold">{l.qty}</span>
                  <button onClick={() => setQty(l.id, 1)} aria-label="Agregar uno" className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-sky text-white">
                    <Plus className="h-3 w-3" />
                  </button>
                  <button onClick={() => setCart((p) => p.filter((x) => x.id !== l.id))} aria-label="Eliminar" className="grid h-7 w-7 place-items-center rounded-lg text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {checkout && !paying && (
              <div className="space-y-2">
                <Field label="Nombre y apellidos" icon={User} value={rName} onChange={setRName} placeholder="Ej: María Pérez González" />
                <Field
                  label="Teléfono en Cuba"
                  icon={Phone}
                  value={rPhone}
                  onChange={(v) => setRPhone(v.replace(/\D/g, "").slice(0, 8))}
                  placeholder="56530329"
                  hint={`+53 · ${rPhone.length}/8 dígitos`}
                />
                <Field
                  label="Carnet de identidad"
                  icon={IdCard}
                  value={rCard}
                  onChange={(v) => setRCard(v.replace(/\D/g, "").slice(0, 11))}
                  placeholder="85010112345"
                  hint={`${rCard.length}/11 dígitos`}
                />
                <Field label="Dirección de entrega" icon={MapPin} value={rAddress} onChange={setRAddress} placeholder="Calle, número, entre calles, municipio y provincia" />
              </div>
            )}

            {checkout && paying && pixCode && (
              <div className="space-y-3 rounded-2xl border border-gold/40 bg-card p-3 animate-rise">
                <p className="text-xs font-extrabold uppercase text-muted-foreground">
                  Paga primero por PIX — el pedido se envía al confirmar el pago
                </p>
                <div className="rounded-xl bg-gradient-vip p-3">
                  <p className="text-[11px] font-extrabold uppercase text-muted-foreground">Monto exacto</p>
                  <p className="font-display text-2xl font-extrabold text-gold">{formatMoney(total, "BRL")}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixCode);
                    toast.success("Código PIX copiado");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-sky px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-95"
                >
                  <Copy className="h-4 w-4" /> Copiar código PIX
                </button>
                <PixQrCode value={pixCode} />
                <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm font-bold">
                  <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>Ya realicé el pago por PIX de {formatMoney(total, "BRL")}</span>
                </label>
              </div>
            )}

            {cart.length > 0 && (
              <>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-gradient-vip p-3">
                  <span className="text-xs font-extrabold uppercase text-muted-foreground">Total</span>
                  <span className="font-display text-xl font-extrabold text-gold">{formatMoney(total, "BRL")}</span>
                </div>
                {!checkout ? (
                  <button
                    onClick={() => setCheckout(true)}
                    className="mt-3 w-full rounded-xl bg-gradient-amber px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-95"
                  >
                    Continuar con el pedido
                  </button>
                ) : !paying ? (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setCheckout(false)} className="rounded-xl border border-border px-4 py-3 text-sm font-extrabold">
                      Atrás
                    </button>
                    <button
                      onClick={goToPayment}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-amber px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-95"
                    >
                      <Copy className="h-4 w-4" /> Pagar con PIX
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setPaying(false); setPaid(false); }} className="rounded-xl border border-border px-4 py-3 text-sm font-extrabold">
                      Atrás
                    </button>
                    <button
                      onClick={() => submit.mutate()}
                      disabled={submit.isPending || !paid}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-4 py-3 text-sm font-extrabold text-white shadow-glow transition-transform active:scale-95 disabled:opacity-60"
                    >
                      {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Confirmar pago y pedido
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
