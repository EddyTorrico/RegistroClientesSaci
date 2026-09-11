import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { TrendingUp, Building2, CalendarClock, ChevronRight } from "lucide-react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl p-5 ${className}`} style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06), 0 1px 12px rgba(15,38,71,0.04)" }}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: number; tint: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: tint + "1A", color: tint }}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-semibold text-[#0F2647]">{value}</div>
        <div className="text-xs text-[#5B6670]">{label}</div>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const esVendedor = profile?.role === "vendedor";

  const [visitasHoy, setVisitasHoy] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [seguimientos, setSeguimientos] = useState<any[]>([]);
  const [equipo, setEquipo] = useState<{ full_name: string; visitas: number }[]>([]);

  useEffect(() => {
    if (!profile) return;
    cargarDatos();
  }, [profile]);

  async function cargarDatos() {
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    let visitasQuery = supabase.from("visits").select("id, user_id").gte("visit_date", hoyInicio.toISOString());
    if (esVendedor) visitasQuery = visitasQuery.eq("user_id", profile!.id);
    const { data: visitas } = await visitasQuery;
    setVisitasHoy(visitas?.length ?? 0);

    const { count } = await supabase.from("customers").select("id", { count: "exact", head: true });
    setTotalClientes(count ?? 0);

    let followQuery = supabase
      .from("follow_ups")
      .select("id, customer_id, type, scheduled_date, user_id, completed, customers(name)")
      .eq("completed", false)
      .order("scheduled_date", { ascending: true })
      .limit(10);
    if (esVendedor) followQuery = followQuery.eq("user_id", profile!.id);
    const { data: follows } = await followQuery;
    setSeguimientos(follows ?? []);

    if (!esVendedor && visitas) {
      const { data: perfiles } = await supabase.from("profiles").select("id, full_name");
      const conteo: Record<string, number> = {};
      visitas.forEach((v: any) => {
        conteo[v.user_id] = (conteo[v.user_id] ?? 0) + 1;
      });
      setEquipo((perfiles ?? []).map((p: any) => ({ full_name: p.full_name, visitas: conteo[p.id] ?? 0 })));
    }
  }

  return (
    <Layout title={`Hola, ${profile?.full_name ?? ""} 👋`} subtitle="Esto es lo que tienes hoy">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={TrendingUp} label={esVendedor ? "Mis visitas hoy" : "Visitas del equipo hoy"} value={visitasHoy} tint="#1B3A6B" />
          <StatCard icon={Building2} label="Clientes registrados" value={totalClientes} tint="#5B6670" />
          <StatCard icon={CalendarClock} label="Seguimientos pendientes" value={seguimientos.length} tint="#B8863B" />
        </div>

        {!esVendedor && equipo.length > 0 && (
          <Card>
            <div className="text-sm font-semibold mb-3 text-[#0F2647]">Resumen por vendedor</div>
            <div className="space-y-2">
              {equipo.map((v) => (
                <div key={v.full_name} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#EEF0F2]">
                  <span className="text-sm font-medium text-[#0F2647]">{v.full_name}</span>
                  <span className="text-xs text-[#5B6670]">{v.visitas} visitas hoy</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <div className="text-sm font-semibold mb-3 text-[#0F2647]">Próximas acciones</div>
          <div className="space-y-2">
            {seguimientos.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/clientes/${s.customer_id}`)}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left hover:bg-[#F5F6F8] border border-[#ECEEF1]"
              >
                <div>
                  <div className="text-sm font-medium text-[#0F2647]">{s.customers?.name}</div>
                  <div className="text-xs text-[#5B6670]">
                    {s.type} · {new Date(s.scheduled_date).toLocaleDateString("es-BO")}
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#5B6670]" />
              </button>
            ))}
            {seguimientos.length === 0 && <div className="text-sm italic text-[#5B6670]">Sin seguimientos pendientes.</div>}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
