import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { Phone, MessageCircle, MapPin, Package, CalendarClock, Search } from "lucide-react";

const ICONOS: Record<string, any> = { Llamar: Phone, WhatsApp: MessageCircle, Visitar: MapPin, "Enviar cotización": Package };

function hoyISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function sumarDiasISO(n: number) { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fechaBO(fecha: string) { const [y,m,d]=fecha.split("-").map(Number); return new Date(y,m-1,d,12).toLocaleDateString("es-BO"); }
function semaforo(s:any) {
  if (s.completed) return { key:"verde", label:"Completado", dot:"#3E7A56", bg:"#EAF4EE", text:"#2F6846" };
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

  useEffect(() => { if (profile) cargar(); }, [profile]);

  async function cargar() {
    let base = supabase.from("follow_ups").select("*, customers(name), profiles(full_name)").order("scheduled_date");
    if (profile?.role === "vendedor") base = base.eq("user_id", profile.id);
    const { data } = await base;
    setItems(data ?? []);
  }

  async function marcar(id: string, completed: boolean) { await supabase.from("follow_ups").update({ completed }).eq("id", id); cargar(); }

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
      const Icon = ICONOS[s.type] ?? CalendarClock; const sem = semaforo(s);
      return <div key={s.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border-l-4 border-y border-r" style={{ borderLeftColor: sem.dot, borderTopColor:"#ECEEF1", borderRightColor:"#ECEEF1", borderBottomColor:"#ECEEF1" }}>
        <button onClick={() => marcar(s.id, !s.completed)} className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: s.completed ? "#3E7A56" : "#C7CCD2", backgroundColor: s.completed ? "#3E7A56" : "white" }}>{s.completed && <span className="text-white text-[10px]">✓</span>}</button>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#EEF0F2] text-[#1B3A6B]"><Icon size={16} /></div>
        <button onClick={() => navigate(`/clientes/${s.customer_id}`)} className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-[#0F2647] truncate" style={{ textDecoration: s.completed ? "line-through" : "none" }}>{s.customers?.name}</div>
          <div className="text-xs text-[#5B6670]">{s.type} · {fechaBO(s.scheduled_date)} {s.notes && `· ${s.notes}`}</div>
          {s.profiles?.full_name && <div className="text-[11px] text-[#8A929A] mt-0.5">{s.profiles.full_name}</div>}
        </button>
        <span className="text-[10px] px-2 py-1 rounded-full shrink-0" style={{ backgroundColor:sem.bg, color:sem.text }}>{sem.label}</span>
      </div>;
    })}{lista.length===0 && <div className="text-sm italic text-[#5B6670]">Nada por aquí.</div>}</div>;
  }

  return <Layout title="Seguimientos" subtitle="Prioriza acciones por fecha y estado">
    <div className="space-y-5 max-w-4xl">
      <div className="grid grid-cols-3 gap-3"><Mini label="Vencidos" value={vencidos} tone="red"/><Mini label="Próximos 3 días" value={proximos} tone="yellow"/><Mini label="Completados" value={items.filter(s=>s.completed).length} tone="green"/></div>
      <Card><div className="flex flex-col md:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-[#8A929A]"/><input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar cliente, acción, nota o vendedor..." className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm"/></div><select value={filtro} onChange={e=>setFiltro(e.target.value)} className="border rounded-xl px-3 py-2.5 text-sm"><option value="todos">Todos</option><option value="rojo">🔴 Vencidos</option><option value="amarillo">🟡 Próximos</option><option value="verde">🟢 Completados</option><option value="gris">⚪ Programados</option></select></div></Card>
      <Card><div className="text-sm font-semibold mb-3 text-[#0F2647]">Pendientes ({pendientes.length})</div><Lista lista={pendientes}/></Card>
      <Card><div className="text-sm font-semibold mb-3 text-[#0F2647]">Completados ({completados.length})</div><Lista lista={completados}/></Card>
    </div>
  </Layout>;
}
function Mini({label,value,tone}:{label:string;value:number;tone:"red"|"yellow"|"green"}){const map:any={red:["#FBEDEC","#9F3F39"],yellow:["#FFF6DF","#8A6215"],green:["#EAF4EE","#2F6846"]};return <div className="rounded-2xl p-4" style={{backgroundColor:map[tone][0]}}><div className="text-xl font-semibold" style={{color:map[tone][1]}}>{value}</div><div className="text-xs text-[#5B6670]">{label}</div></div>}
