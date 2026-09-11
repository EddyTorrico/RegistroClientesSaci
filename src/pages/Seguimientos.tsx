import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { Phone, MessageCircle, MapPin, Package, CalendarClock } from "lucide-react";

const ICONOS: Record<string, any> = { Llamar: Phone, WhatsApp: MessageCircle, Visitar: MapPin, "Enviar cotización": Package };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06), 0 1px 12px rgba(15,38,71,0.04)" }}>
      {children}
    </div>
  );
}

export function Seguimientos() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [completados, setCompletados] = useState<any[]>([]);

  useEffect(() => {
    if (profile) cargar();
  }, [profile]);

  async function cargar() {
    let base = supabase.from("follow_ups").select("*, customers(name)").order("scheduled_date");
    if (profile?.role === "vendedor") base = base.eq("user_id", profile.id);
    const { data } = await base;
    setPendientes((data ?? []).filter((s: any) => !s.completed));
    setCompletados((data ?? []).filter((s: any) => s.completed));
  }

  async function marcar(id: string, completed: boolean) {
    await supabase.from("follow_ups").update({ completed }).eq("id", id);
    cargar();
  }

  function Lista({ items, tachado }: { items: any[]; tachado: boolean }) {
    return (
      <div className="space-y-2">
        {items.map((s) => {
          const Icon = ICONOS[s.type] ?? CalendarClock;
          return (
            <div key={s.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border" style={{ borderColor: "#ECEEF1" }}>
              <button
                onClick={() => marcar(s.id, !tachado)}
                className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                style={{ borderColor: tachado ? "#3E7A56" : "#C7CCD2", backgroundColor: tachado ? "#3E7A56" : "white" }}
              >
                {tachado && <span className="text-white text-[10px]">✓</span>}
              </button>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#EEF0F2] text-[#1B3A6B]">
                <Icon size={16} />
              </div>
              <button onClick={() => navigate(`/clientes/${s.customer_id}`)} className="flex-1 text-left">
                <div className="text-sm font-medium text-[#0F2647]" style={{ textDecoration: tachado ? "line-through" : "none" }}>
                  {s.customers?.name}
                </div>
                <div className="text-xs text-[#5B6670]">
                  {s.type} · {new Date(s.scheduled_date).toLocaleDateString("es-BO")} {s.notes && `· ${s.notes}`}
                </div>
              </button>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-sm italic text-[#5B6670]">Nada por aquí.</div>}
      </div>
    );
  }

  return (
    <Layout title="Seguimientos">
      <div className="space-y-6 max-w-2xl">
        <Card>
          <div className="text-sm font-semibold mb-3 text-[#0F2647]">Pendientes ({pendientes.length})</div>
          <Lista items={pendientes} tachado={false} />
        </Card>
        <Card>
          <div className="text-sm font-semibold mb-3 text-[#0F2647]">Completados ({completados.length})</div>
          <Lista items={completados} tachado={true} />
        </Card>
      </div>
    </Layout>
  );
}
