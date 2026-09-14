import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { CalendarClock, CircleDollarSign, Search } from "lucide-react";

const ESTADOS = [
  { key: "detectada", label: "Detectada", color: "#5B6670" },
  { key: "en_negociacion", label: "En negociación", color: "#B8863B" },
  { key: "atendida", label: "Atendida", color: "#3E7A56" },
  { key: "cerrada", label: "Cerrada", color: "#2F6846" },
  { key: "ganada", label: "Ganada", color: "#3E7A56" },
  { key: "perdida", label: "Perdida", color: "#C0564F" },
];

const money = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function hoyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sumarDiasISO(dias: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function semaforo(o: any) {
  if (["atendida", "cerrada", "ganada", "perdida"].includes(o.estado)) {
    return { key: "verde", label: "Atendida / cerrada", dot: "#3E7A56", bg: "#EAF4EE", text: "#2F6846" };
  }
  if (!o.next_action_date) return { key: "gris", label: "Sin fecha", dot: "#8A929A", bg: "#F1F3F5", text: "#5B6670" };
  if (o.next_action_date < hoyISO()) return { key: "rojo", label: "Vencida", dot: "#C0564F", bg: "#FBEDEC", text: "#9F3F39" };
  if (o.next_action_date <= sumarDiasISO(3)) return { key: "amarillo", label: "Próxima", dot: "#D39A28", bg: "#FFF6DF", text: "#8A6215" };
  return { key: "gris", label: "Programada", dot: "#7B8794", bg: "#F1F3F5", text: "#5B6670" };
}

function fechaBO(fecha?: string | null) {
  if (!fecha) return "Sin fecha";
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString("es-BO");
}

export function Oportunidades() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroSemaforo, setFiltroSemaforo] = useState("todos");
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => { if (profile) cargar(); }, [profile]);

  async function cargar() {
    let query = supabase
      .from("opportunities")
      .select("*, customers(name), profiles(full_name)")
      .order("created_at", { ascending: false });
    if (profile?.role === "vendedor") query = query.eq("user_id", profile.id);
    const { data } = await query;
    setOportunidades(data ?? []);
  }

  async function actualizar(id: string, cambios: Record<string, any>) {
    setGuardando(id);
    const { error } = await supabase.from("opportunities").update(cambios).eq("id", id);
    setGuardando(null);
    if (!error) cargar();
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return oportunidades.filter((o) => {
      const sem = semaforo(o).key;
      const coincideSem = filtroSemaforo === "todos" || sem === filtroSemaforo;
      const coincideTexto = !q || `${o.title} ${o.customers?.name ?? ""} ${o.profiles?.full_name ?? ""}`.toLowerCase().includes(q);
      return coincideSem && coincideTexto;
    });
  }, [oportunidades, busqueda, filtroSemaforo]);

  const resumen = useMemo(() => ({
    vencidas: oportunidades.filter((o) => semaforo(o).key === "rojo").length,
    proximas: oportunidades.filter((o) => semaforo(o).key === "amarillo").length,
    abiertas: oportunidades.filter((o) => !["atendida", "cerrada", "ganada", "perdida"].includes(o.estado)).length,
    pipeline: oportunidades.filter((o) => !["perdida"].includes(o.estado)).reduce((a, o) => a + Number(o.valor_estimado || 0), 0),
  }), [oportunidades]);

  return (
    <Layout title="Oportunidades" subtitle="Semáforo comercial y próximas acciones">
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Mini label="Vencidas" value={resumen.vencidas} tone="red" />
          <Mini label="Próximas 3 días" value={resumen.proximas} tone="yellow" />
          <Mini label="Abiertas" value={resumen.abiertas} />
          <Mini label="Pipeline Bs" value={money.format(resumen.pipeline)} />
        </div>

        <div className="bg-white rounded-2xl p-4 flex flex-col md:flex-row gap-3" style={{ boxShadow: "0 1px 12px rgba(15,38,71,0.05)" }}>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-[#8A929A]" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar oportunidad, cliente o vendedor..." className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm" />
          </div>
          <select value={filtroSemaforo} onChange={(e) => setFiltroSemaforo(e.target.value)} className="border rounded-xl px-3 py-2.5 text-sm">
            <option value="todos">Todos los semáforos</option>
            <option value="rojo">🔴 Vencidas</option>
            <option value="amarillo">🟡 Próximas</option>
            <option value="verde">🟢 Atendidas / cerradas</option>
            <option value="gris">⚪ Programadas / sin fecha</option>
          </select>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {ESTADOS.map((estado) => {
            const items = filtradas.filter((o) => o.estado === estado.key);
            return (
              <div key={estado.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: estado.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#5B6670]">{estado.label} · {items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((o) => {
                    const sem = semaforo(o);
                    return (
                      <div key={o.id} className="bg-white rounded-xl p-3.5 border-l-4" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06)", borderLeftColor: sem.dot }}>
                        <div className="flex justify-between gap-2 mb-2">
                          <button onClick={() => navigate(`/clientes/${o.customer_id}`)} className="text-left min-w-0">
                            <div className="text-sm font-medium text-[#0F2647] truncate">{o.title}</div>
                            <div className="text-xs text-[#5B6670] truncate">{o.customers?.name}</div>
                          </button>
                          <span className="shrink-0 text-[10px] px-2 py-1 rounded-full h-fit" style={{ backgroundColor: sem.bg, color: sem.text }}>{sem.label}</span>
                        </div>
                        <div className="text-xs text-[#1B3A6B] mb-2 flex items-center gap-1"><CircleDollarSign size={13} /> Bs {money.format(Number(o.valor_estimado || 0))} · {o.probabilidad ?? 0}%</div>
                        {o.profiles?.full_name && <div className="text-[11px] text-[#7B8794] mb-2">Vendedor: {o.profiles.full_name}</div>}
                        <label className="text-[11px] text-[#5B6670] flex items-center gap-1 mb-1"><CalendarClock size={12} /> Próxima acción</label>
                        <input type="date" value={o.next_action_date ?? ""} disabled={guardando === o.id} onChange={(e) => actualizar(o.id, { next_action_date: e.target.value || null })} className="w-full text-xs border rounded-lg px-2 py-1.5 mb-2" />
                        <div className="text-[10px] text-[#7B8794] mb-2">{fechaBO(o.next_action_date)}</div>
                        <select value={o.estado} disabled={guardando === o.id} onChange={(e) => actualizar(o.id, { estado: e.target.value })} className="w-full text-xs border rounded-lg px-1.5 py-1.5">
                          {ESTADOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  {items.length === 0 && <div className="text-xs italic text-[#5B6670]">Sin oportunidades.</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function Mini({ label, value, tone = "normal" }: { label: string; value: string | number; tone?: "normal" | "red" | "yellow" }) {
  const bg = tone === "red" ? "#FBEDEC" : tone === "yellow" ? "#FFF6DF" : "white";
  const color = tone === "red" ? "#9F3F39" : tone === "yellow" ? "#8A6215" : "#0F2647";
  return <div className="rounded-2xl p-4" style={{ backgroundColor: bg, boxShadow: "0 1px 8px rgba(15,38,71,0.05)" }}><div className="text-xl font-semibold" style={{ color }}>{value}</div><div className="text-xs text-[#5B6670]">{label}</div></div>;
}
