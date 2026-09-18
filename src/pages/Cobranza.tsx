import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, Search, WalletCards, X, MessageCircle } from "lucide-react";

const money = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
function dateBO(v?: string | null) { if (!v) return "—"; const [y, m, d] = v.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString("es-BO"); }
function status(s: any) { if (Number(s.balance) <= 0) return "pagada"; if (s.due_date && s.due_date < today()) return "vencida"; const d = new Date(); d.setDate(d.getDate() + 3); const lim = d.toISOString().slice(0, 10); if (s.due_date && s.due_date <= lim) return "proxima"; return "pendiente"; }
const badge: any = { vencida: "bg-red-100 text-red-700", proxima: "bg-amber-100 text-amber-700", pendiente: "bg-slate-100 text-slate-700", pagada: "bg-green-100 text-green-700" };

const PROMESA = "Promesa de pago";
const GESTION = "Gestión de cobranza";

export function Cobranza() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pendientes");
  const [selected, setSelected] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Transferencia");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [gestionSale, setGestionSale] = useState<any>(null);
  const [gestionType, setGestionType] = useState(PROMESA);
  const [gestionDate, setGestionDate] = useState("");
  const [gestionNotes, setGestionNotes] = useState("");
  const [savingGestion, setSavingGestion] = useState(false);

  useEffect(() => { if (profile) load(); }, [profile?.id]);

  // Enlace directo desde el Tablero (?venta=<id>): filtra por esa venta.
  useEffect(() => {
    const ventaId = params.get("venta");
    if (ventaId && sales.length) {
      const s = sales.find(x => x.id === ventaId);
      if (s) { setSearch(s.sale_number); setFilter("todos"); }
      setParams({});
    }
  }, [sales.length, params]);

  async function load() {
    setError("");
    let sq = supabase.from("sales").select("id,sale_number,customer_id,user_id,sale_date,payment_method,status,total,amount_paid,balance,due_date,observations").neq("status", "borrador").order("due_date", { ascending: true });
    if (profile?.role === "vendedor") sq = sq.eq("user_id", profile.id);
    const [s, c, p, f] = await Promise.all([
      sq,
      supabase.from("customers").select("id,name,phone").order("name"),
      supabase.from("sale_payments").select("id,sale_id,payment_date,amount,payment_method,reference,notes,created_at").order("created_at", { ascending: false }),
      supabase.from("follow_ups").select("id,sale_id,type,scheduled_date,scheduled_time,completed,notes,auto_generated").not("sale_id", "is", null).order("scheduled_date"),
    ]);
    if (s.error || c.error || p.error || f.error) setError((s.error || c.error || p.error || f.error)?.message || "");
    setSales(s.data || []); setCustomers(c.data || []); setPayments(p.data || []); setFollowUps(f.data || []);
  }

  const rows = useMemo(() => sales.filter(s => {
    const st = status(s);
    const ok = filter === "todos" || (filter === "pendientes" ? Number(s.balance) > 0 : st === filter);
    const name = customers.find(c => c.id === s.customer_id)?.name || "";
    return ok && `${s.sale_number} ${name}`.toLowerCase().includes(search.toLowerCase());
  }), [sales, customers, search, filter]);

  const active = sales.filter(s => s.status !== "anulada");
  const total = active.reduce((a, s) => a + Number(s.total || 0), 0);
  const collected = active.reduce((a, s) => a + Number(s.amount_paid || 0), 0);
  const balance = active.reduce((a, s) => a + Number(s.balance || 0), 0);
  const overdue = active.filter(s => status(s) === "vencida").reduce((a, s) => a + Number(s.balance || 0), 0);

  function nextOpen(saleId: string, type: string) {
    return followUps.filter(f => f.sale_id === saleId && f.type === type && !f.completed).sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)))[0];
  }

  async function pay() {
    if (!selected || Number(amount) <= 0) return;
    setLoading(true); setError("");
    const { error: e } = await supabase.rpc("register_sale_payment", { p_sale_id: selected.id, p_amount: Number(amount), p_payment_date: today(), p_payment_method: method, p_reference: reference || null, p_notes: notes || null });
    if (e) setError(e.message); else { setSelected(null); setAmount(""); setReference(""); setNotes(""); await load(); }
    setLoading(false);
  }

  function openGestion(s: any) {
    setGestionSale(s);
    setGestionType(PROMESA);
    setGestionDate("");
    setGestionNotes("");
  }

  async function saveGestion() {
    if (!gestionSale || !gestionDate || !profile) return;
    setSavingGestion(true); setError("");
    try {
      // Se cierra cualquier gestión abierta del mismo tipo para esta venta
      // antes de crear la nueva, para no dejar dos "promesas de pago" (o dos
      // "próximas gestiones") abiertas a la vez para la misma venta.
      const openPrevious = nextOpen(gestionSale.id, gestionType);
      if (openPrevious) {
        await supabase.from("follow_ups").update({ completed: true }).eq("id", openPrevious.id);
      }
      const { error: e } = await supabase.from("follow_ups").insert({
        customer_id: gestionSale.customer_id,
        user_id: profile.id,
        sale_id: gestionSale.id,
        type: gestionType,
        scheduled_date: gestionDate,
        notes: gestionNotes.trim() || null,
      });
      if (e) throw e;
      setGestionSale(null);
      await load();
    } catch (e: any) {
      setError(e.message || "No fue posible registrar la gestión.");
    } finally { setSavingGestion(false); }
  }

  return <Layout title="Cobranza" subtitle="Cuentas por cobrar, vencimientos y pagos de ventas"><div className="space-y-5">
    {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <Stat icon={CircleDollarSign} label="Ventas acumuladas" value={`Bs ${money.format(total)}`} />
      <Stat icon={CheckCircle2} label="Cobrado" value={`Bs ${money.format(collected)}`} />
      <Stat icon={WalletCards} label="Saldo por cobrar" value={`Bs ${money.format(balance)}`} />
      <Stat icon={AlertTriangle} label="Cartera vencida" value={`Bs ${money.format(overdue)}`} />
    </div>

    <div className="bg-white rounded-2xl p-5">
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar venta o cliente..." className="w-full border rounded-xl pl-9 pr-3 py-2.5" /></div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="border rounded-xl px-3"><option value="pendientes">Con saldo</option><option value="vencida">Vencidas</option><option value="proxima">Vencen en 3 días</option><option value="pagada">Pagadas</option><option value="todos">Todas</option></select>
      </div>

      {/* Tabla en escritorio */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b text-slate-500"><th className="py-2">Venta</th><th>Cliente</th><th>Vencimiento</th><th>Estado</th><th className="text-right">Saldo</th><th>Promesa de pago</th><th>Siguiente gestión</th><th></th></tr></thead>
          <tbody>{rows.map(s => {
            const c = customers.find(x => x.id === s.customer_id);
            const st = status(s);
            const promesa = nextOpen(s.id, PROMESA);
            const gestion = nextOpen(s.id, GESTION);
            return <tr key={s.id} className="border-b">
              <td className="py-3 font-mono text-xs">{s.sale_number}</td>
              <td>{c?.name || "—"}<div className="text-xs text-slate-500">{c?.phone || ""}</div></td>
              <td>{dateBO(s.due_date)}</td>
              <td><span className={`px-2 py-1 rounded-full text-xs ${badge[st]}`}>{st}</span></td>
              <td className="text-right font-semibold">Bs {money.format(Number(s.balance))}</td>
              <td className="text-xs">{promesa ? <span>{dateBO(promesa.scheduled_date)}{promesa.notes ? <span className="block text-slate-500">{promesa.notes}</span> : null}</span> : <span className="text-slate-400">—</span>}</td>
              <td className="text-xs">{gestion ? <span>{dateBO(gestion.scheduled_date)}{gestion.notes ? <span className="block text-slate-500">{gestion.notes}</span> : null}</span> : <span className="text-slate-400">—</span>}</td>
              <td className="text-right"><div className="flex justify-end gap-1.5">
                {s.status !== "anulada" && <button title="Registrar gestión" onClick={() => openGestion(s)} className="p-1.5 rounded-lg border text-[#1B3A6B]"><MessageCircle size={14} /></button>}
                {Number(s.balance) > 0 && s.status !== "anulada" && <button onClick={() => { setSelected(s); setAmount(String(s.balance)); }} className="px-3 py-1.5 rounded-lg bg-[#1B3A6B] text-white text-xs">Registrar pago</button>}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
        {rows.length === 0 && <div className="text-center py-8 text-sm text-slate-500">Sin registros para el filtro seleccionado.</div>}
      </div>

      {/* Tarjetas en celular */}
      <div className="lg:hidden space-y-2">
        {rows.map(s => {
          const c = customers.find(x => x.id === s.customer_id);
          const st = status(s);
          const promesa = nextOpen(s.id, PROMESA);
          const gestion = nextOpen(s.id, GESTION);
          return <div key={s.id} className="border rounded-xl p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono text-xs text-slate-500">{s.sale_number}</div>
                <div className="font-medium text-[#0F2647]">{c?.name || "—"}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs shrink-0 ${badge[st]}`}>{st}</span>
            </div>
            <div className="flex justify-between text-sm mt-2"><span className="text-slate-500">Vencimiento</span><span>{dateBO(s.due_date)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Saldo</span><b>Bs {money.format(Number(s.balance))}</b></div>
            {promesa && <div className="text-xs mt-1"><CalendarClock size={11} className="inline mr-1" />Promesa de pago: {dateBO(promesa.scheduled_date)}</div>}
            {gestion && <div className="text-xs mt-1"><MessageCircle size={11} className="inline mr-1" />Siguiente gestión: {dateBO(gestion.scheduled_date)}</div>}
            <div className="flex gap-2 mt-3">
              {s.status !== "anulada" && <button onClick={() => openGestion(s)} className="flex-1 py-2 rounded-lg border text-xs text-[#1B3A6B]">Registrar gestión</button>}
              {Number(s.balance) > 0 && s.status !== "anulada" && <button onClick={() => { setSelected(s); setAmount(String(s.balance)); }} className="flex-1 py-2 rounded-lg bg-[#1B3A6B] text-white text-xs">Registrar pago</button>}
            </div>
          </div>;
        })}
        {rows.length === 0 && <div className="text-center py-8 text-sm text-slate-500">Sin registros para el filtro seleccionado.</div>}
      </div>
    </div>

    <div className="bg-white rounded-2xl p-5"><h3 className="font-semibold mb-3">Últimos pagos</h3>{payments.slice(0, 10).map(p => <div key={p.id} className="flex justify-between border-b py-2 text-sm"><span>{sales.find(s => s.id === p.sale_id)?.sale_number || "Venta"} · {dateBO(p.payment_date)} · {p.payment_method}{p.reference ? ` · ${p.reference}` : ""}</span><b>Bs {money.format(Number(p.amount))}</b></div>)}{payments.length === 0 && <div className="text-sm text-slate-500">Aún no hay pagos parciales registrados.</div>}</div>

    {selected && <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex justify-between mb-4"><div><h3 className="font-semibold">Registrar pago</h3><p className="text-xs text-slate-500">{selected.sale_number} · Saldo Bs {money.format(Number(selected.balance))}</p></div><button onClick={() => setSelected(null)}><X size={18} /></button></div>
        <div className="grid gap-3">
          <label className="text-sm">Monto<input type="number" min="0.01" max={selected.balance} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="block w-full border rounded-xl p-2.5 mt-1" /></label>
          <label className="text-sm">Forma de pago<select value={method} onChange={e => setMethod(e.target.value)} className="block w-full border rounded-xl p-2.5 mt-1"><option>Contado</option><option>Transferencia</option><option>QR</option><option>Cheque</option><option>Otro</option></select></label>
          <label className="text-sm">Referencia<input value={reference} onChange={e => setReference(e.target.value)} className="block w-full border rounded-xl p-2.5 mt-1" placeholder="Nro. transferencia, recibo, etc." /></label>
          <label className="text-sm">Observaciones<textarea value={notes} onChange={e => setNotes(e.target.value)} className="block w-full border rounded-xl p-2.5 mt-1" /></label>
          <button disabled={loading || Number(amount) <= 0 || Number(amount) > Number(selected.balance)} onClick={pay} className="py-2.5 rounded-xl bg-[#1B3A6B] text-white disabled:opacity-50">{loading ? "Registrando..." : "Confirmar pago"}</button>
        </div>
      </div>
    </div>}

    {gestionSale && <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex justify-between mb-4"><div><h3 className="font-semibold">Registrar gestión de cobranza</h3><p className="text-xs text-slate-500">{gestionSale.sale_number}</p></div><button onClick={() => setGestionSale(null)}><X size={18} /></button></div>
        <div className="grid gap-3">
          <label className="text-sm">Tipo<select value={gestionType} onChange={e => setGestionType(e.target.value)} className="block w-full border rounded-xl p-2.5 mt-1"><option value={PROMESA}>Promesa de pago</option><option value={GESTION}>Próxima gestión (llamada, visita, etc.)</option></select></label>
          <label className="text-sm">Fecha<input type="date" value={gestionDate} onChange={e => setGestionDate(e.target.value)} className="block w-full border rounded-xl p-2.5 mt-1" /></label>
          <label className="text-sm">Notas<textarea value={gestionNotes} onChange={e => setGestionNotes(e.target.value)} placeholder="Ej.: cliente promete pagar al cobrar su factura del 20." className="block w-full border rounded-xl p-2.5 mt-1" /></label>
          <button disabled={savingGestion || !gestionDate} onClick={saveGestion} className="py-2.5 rounded-xl bg-[#1B3A6B] text-white disabled:opacity-50">{savingGestion ? "Guardando..." : "Guardar gestión"}</button>
        </div>
      </div>
    </div>}
  </div></Layout>;
}

function Stat({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return <div className="bg-white rounded-2xl p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Icon size={18} /></div><div className="min-w-0"><div className="text-lg font-semibold text-[#0F2647] truncate">{value}</div><div className="text-xs text-slate-500">{label}</div></div></div>;
}
