import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { Phone, MessageCircle, MapPin, Package, CalendarClock, Search, X, FileText, ShoppingBag, Truck, Building2 } from "lucide-react";

const ICONOS: Record<string, any> = { Llamar: Phone, WhatsApp: MessageCircle, Visitar: MapPin, "Enviar cotización": Package, "Hacer seguimiento a la cotización": Package };
const NEXT_ACTIONS = ["Llamar", "Visitar", "WhatsApp", "Enviar cotización", "Hacer seguimiento a la cotización", "Enviar información", "Reunión comercial"];

// Indica a qué tipo de registro está vinculado el seguimiento (cliente,
// cotización, venta o entrega) y a dónde debe llevar el clic.
function vinculo(s: any) {
  if (s.quotation_id) return { label: "Cotización", icon: FileText, href: `/cotizaciones?ver=${s.quotation_id}` };
  if (s.sale_id && String(s.type || "").startsWith("Cobranza")) return { label: "Cobranza", icon: Truck, href: `/cobranza?venta=${s.sale_id}` };
  if (s.sale_id) return { label: "Venta", icon: ShoppingBag, href: `/ventas?ver=${s.sale_id}` };
  if (s.delivery_note_id) return { label: "Entrega", icon: Truck, href: `/ventas` };
  return { label: "Cliente", icon: Building2, href: `/clientes/${s.customer_id}` };
}

function hoyISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function sumarDiasISO(n: number) { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fechaBO(fecha: string) { const [y,m,d]=fecha.split("-").map(Number); return new Date(y,m-1,d,12).toLocaleDateString("es-BO"); }
function semaforo(s:any) {
  if (s.completed) return { key:"verde", label:"Atendida / cerrada", dot:"#3E7A56", bg:"#EAF4EE", text:"#2F6846" };
  if (s.scheduled_date < hoyISO()) return { key:"rojo", label:"Vencido", dot:"#C0564F", bg:"#FBEDEC", text:"#9F3F39" };
  if (s.scheduled_date <= sumarDiasISO(3)) return { key:"amarillo", label:"Próximo", dot:"#D39A28", bg:"#FFF6DF", text:"#8A6215" };
  return { key:"gris", label:"Programado", dot:"#7B8794", bg:"#F1F3F5", text:"#5B6670" };
}
function Card({ children }: { children: React.ReactNode }) { return <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 1px 12px rgba(15,38,71,0.05)" }}>{children}</div>; }

export function Seguimientos() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [selected, setSelected] = useState<any>(null);
  const [closeMode, setCloseMode] = useState<"continue"|"close">("continue");
  const [nextType, setNextType] = useState("Hacer seguimiento a la cotización");
  const [nextDate, setNextDate] = useState(sumarDiasISO(3));
  const [nextNotes, setNextNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (profile) cargar(); }, [profile]);

  async function cargar() {
    let base = supabase.from("follow_ups").select("*, customers(name), profiles(full_name)").order("scheduled_date");
    if (profile?.role === "vendedor") base = base.eq("user_id", profile.id);
    const { data, error } = await base;
    if (error) setError(error.message);
    setItems(data ?? []);
  }

  function openComplete(s: any) {
    setSelected(s);
    setCloseMode("continue");
    setNextType(s.type === "Enviar cotización" ? "Hacer seguimiento a la cotización" : "Llamar");
    setNextDate(sumarDiasISO(3));
    setNextNotes("");
  }

  async function reopen(s: any) {
    setError("");
    const { error } = await supabase.from("follow_ups").update({ completed: false }).eq("id", s.id);
    if (error) return setError(error.message);
    if (s.opportunity_id) await supabase.from("opportunities").update({ estado: "en_negociacion", next_action_date: s.scheduled_date }).eq("id", s.opportunity_id);
    await cargar();
  }

  async function confirmComplete() {
    if (!selected) return;
    if (closeMode === "continue" && !nextDate) return setError("Selecciona la fecha del siguiente seguimiento.");
    setSaving(true); setError("");
    try {
      const { error: currentError } = await supabase.from("follow_ups").update({ completed: true }).eq("id", selected.id);
      if (currentError) throw currentError;

      if (closeMode === "continue") {
        const { error: nextError } = await supabase.from("follow_ups").insert({
          customer_id: selected.customer_id,
          user_id: selected.user_id,
          opportunity_id: selected.opportunity_id || null,
          type: nextType,
          scheduled_date: nextDate,
          completed: false,
          notes: nextNotes || `Seguimiento posterior a: ${selected.type}`,
        });
        if (nextError) throw nextError;
        if (selected.opportunity_id) {
          const { error: oppError } = await supabase.from("opportunities").update({ estado: "en_negociacion", next_action_date: nextDate }).eq("id", selected.opportunity_id);
          if (oppError) throw oppError;
        }
      } else if (selected.opportunity_id) {
        const { error: oppError } = await supabase.from("opportunities").update({ estado: "cerrada", next_action_date: null }).eq("id", selected.opportunity_id);
        if (oppError) throw oppError;
      }

      setSelected(null);
      await cargar();
    } catch (e:any) { setError(e.message || "No fue posible completar el seguimiento."); }
    finally { setSaving(false); }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((s) => {
      const sem = semaforo(s).key;
      const coincide = filtro === "todos" || sem === filtro;
      const texto = `${s.customers?.name ?? ""} ${s.type ?? ""} ${s.notes ?? ""} ${s.profiles?.full_name ?? ""}`.toLowerCase();
      return coincide && (!q || texto.includes(q));
    });
  }, [items, busqueda, filtro]);

  const pendientes = filtrados.filter((s) => !s.completed);
  const completados = filtrados.filter((s) => s.completed);
  const vencidos = items.filter((s) => semaforo(s).key === "rojo").length;
  const proximos = items.filter((s) => semaforo(s).key === "amarillo").length;

  function Lista({ lista }: { lista: any[] }) {
    return <div className="space-y-2">{lista.map((s) => {
      const Icon = ICONOS[s.type] ?? CalendarClock; const sem = semaforo(s); const v = vinculo(s); const VIcon = v.icon;
      return <div key={s.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border-l-4 border-y border-r" style={{ borderLeftColor: sem.dot, borderTopColor:"#ECEEF1", borderRightColor:"#ECEEF1", borderBottomColor:"#ECEEF1" }}>
        <button onClick={() => s.completed ? reopen(s) : openComplete(s)} className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: s.completed ? "#3E7A56" : "#C7CCD2", backgroundColor: s.completed ? "#3E7A56" : "white" }}>{s.completed && <span className="text-white text-[10px]">✓</span>}</button>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#EEF0F2] text-[#1B3A6B]"><Icon size={16} /></div>
        <button onClick={() => navigate(v.href)} className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-[#0F2647] truncate" style={{ textDecoration: s.completed ? "line-through" : "none" }}>{s.customers?.name}</div>
          <div className="text-xs text-[#5B6670]">{s.type} · {fechaBO(s.scheduled_date)} {s.notes && `· ${s.notes}`}</div>
          {s.profiles?.full_name && <div className="text-[11px] text-[#8A929A] mt-0.5">{s.profiles.full_name}</div>}
        </button>
        <span title={`Vinculado a: ${v.label}`} className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full shrink-0 bg-[#EEF0F2] text-[#5B6670]"><VIcon size={11}/>{v.label}</span>
        <span className="text-[10px] px-2 py-1 rounded-full shrink-0" style={{ backgroundColor:sem.bg, color:sem.text }}>{sem.label}</span>
      </div>;
    })}{lista.length===0 && <div className="text-sm italic text-[#5B6670]">Nada por aquí.</div>}</div>;
  }

  return <Layout title="Seguimientos" subtitle="Prioriza acciones por fecha y encadena el siguiente paso comercial">
    <div className="space-y-5 max-w-4xl">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3"><Mini label="Vencidos" value={vencidos} tone="red"/><Mini label="Próximos 3 días" value={proximos} tone="yellow"/><Mini label="Atendidos" value={items.filter(s=>s.completed).length} tone="green"/></div>
      <Card><div className="flex flex-col md:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-[#8A929A]"/><input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar cliente, acción, nota o vendedor..." className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm"/></div><select value={filtro} onChange={e=>setFiltro(e.target.value)} className="border rounded-xl px-3 py-2.5 text-sm"><option value="todos">Todos</option><option value="rojo">🔴 Vencidos</option><option value="amarillo">🟡 Próximos</option><option value="verde">🟢 Atendidos / cerrados</option><option value="gris">⚪ Programados</option></select></div></Card>
      <Card><div className="text-sm font-semibold mb-3 text-[#0F2647]">Pendientes ({pendientes.length})</div><Lista lista={pendientes}/></Card>
      <Card><div className="text-sm font-semibold mb-3 text-[#0F2647]">Atendidos / cerrados ({completados.length})</div><Lista lista={completados}/></Card>
    </div>

    {selected && <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-5 max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4"><div><h2 className="font-semibold text-[#0F2647]">Completar seguimiento</h2><div className="text-xs text-[#5B6670]">{selected.customers?.name} · {selected.type}</div></div><button onClick={() => setSelected(null)}><X size={18}/></button></div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => setCloseMode("continue")} className={`rounded-xl border p-3 text-sm ${closeMode === "continue" ? "bg-[#1B3A6B] text-white" : "bg-white"}`}>Atendida · continuar</button>
          <button onClick={() => setCloseMode("close")} className={`rounded-xl border p-3 text-sm ${closeMode === "close" ? "bg-[#3E7A56] text-white" : "bg-white"}`}>Cerrar oportunidad</button>
        </div>
        {closeMode === "continue" && <div className="space-y-3">
          <label className="block text-xs text-[#5B6670]">Siguiente acción<select value={nextType} onChange={e => setNextType(e.target.value)} className="w-full border rounded-xl p-2.5 mt-1 text-sm">{NEXT_ACTIONS.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="block text-xs text-[#5B6670]">Fecha del próximo seguimiento<input type="date" min={hoyISO()} value={nextDate} onChange={e => setNextDate(e.target.value)} className="w-full border rounded-xl p-2.5 mt-1 text-sm"/></label>
          <label className="block text-xs text-[#5B6670]">Nota<input value={nextNotes} onChange={e => setNextNotes(e.target.value)} placeholder="Ej.: confirmar recepción de cotización" className="w-full border rounded-xl p-2.5 mt-1 text-sm"/></label>
        </div>}
        {closeMode === "close" && <div className="text-sm text-[#5B6670] bg-[#F7F8FA] rounded-xl p-3">El seguimiento quedará atendido y la oportunidad asociada pasará a estado <b>Cerrada</b>, sin próxima fecha.</div>}
        <button disabled={saving} onClick={confirmComplete} className="w-full mt-4 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Guardando..." : closeMode === "continue" ? "Atender y crear siguiente seguimiento" : "Cerrar seguimiento y oportunidad"}</button>
      </div>
    </div>}
  </Layout>;
}

function Mini({label,value,tone}:{label:string;value:number;tone:"red"|"yellow"|"green"}){const map:any={red:["#FBEDEC","#9F3F39"],yellow:["#FFF6DF","#8A6215"],green:["#EAF4EE","#2F6846"]};return <div className="rounded-2xl p-4" style={{backgroundColor:map[tone][0]}}><div className="text-xl font-semibold" style={{color:map[tone][1]}}>{value}</div><div className="text-xs text-[#5B6670]">{label}</div></div>}
