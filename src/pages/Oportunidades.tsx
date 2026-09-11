import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

const ESTADOS = [
  { key: "detectada", label: "Detectada", color: "#5B6670" },
  { key: "en_negociacion", label: "En negociación", color: "#B8863B" },
  { key: "ganada", label: "Ganada", color: "#3E7A56" },
  { key: "perdida", label: "Perdida", color: "#C0564F" },
];

export function Oportunidades() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [oportunidades, setOportunidades] = useState<any[]>([]);

  useEffect(() => {
    if (profile) cargar();
  }, [profile]);

  async function cargar() {
    let query = supabase.from("opportunities").select("*, customers(name)");
    if (profile?.role === "vendedor") query = query.eq("user_id", profile.id);
    const { data } = await query;
    setOportunidades(data ?? []);
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.from("opportunities").update({ estado }).eq("id", id);
    cargar();
  }

  return (
    <Layout title="Oportunidades">
      <div className="grid grid-cols-4 gap-4">
        {ESTADOS.map((estado) => {
          const items = oportunidades.filter((o) => o.estado === estado.key);
          return (
            <div key={estado.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: estado.color }} />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#5B6670]">
                  {estado.label} · {items.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {items.map((o) => (
                  <div key={o.id} className="bg-white rounded-xl p-3.5" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06)" }}>
                    <button onClick={() => navigate(`/clientes/${o.customer_id}`)} className="text-left w-full mb-2">
                      <div className="text-sm font-medium text-[#0F2647]">{o.title}</div>
                      <div className="text-xs text-[#5B6670]">{o.customers?.name}</div>
                    </button>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-mono text-[#1B3A6B]">
                        Bs {o.valor_estimado ?? 0} · {o.probabilidad ?? 0}%
                      </span>
                    </div>
                    <select
                      value={o.estado}
                      onChange={(e) => cambiarEstado(o.id, e.target.value)}
                      className="w-full text-xs border rounded-lg px-1.5 py-1"
                      style={{ borderColor: "#DDD8C8" }}
                    >
                      {ESTADOS.map((e) => (
                        <option key={e.key} value={e.key}>{e.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {items.length === 0 && <div className="text-xs italic text-[#5B6670]">Sin oportunidades.</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
