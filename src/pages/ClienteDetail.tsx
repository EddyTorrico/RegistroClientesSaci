import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { supabase } from "../lib/supabase";
import { ChevronLeft, MapPin, Phone, MessageCircle } from "lucide-react";

const interesColor: Record<string, string> = { Bajo: "#C0564F", Medio: "#B8863B", Alto: "#3E7A56" };
const estadoOportunidad: Record<string, { label: string; color: string }> = {
  detectada: { label: "Detectada", color: "#5B6670" },
  en_negociacion: { label: "En negociación", color: "#B8863B" },
  ganada: { label: "Ganada", color: "#3E7A56" },
  perdida: { label: "Perdida", color: "#C0564F" },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06), 0 1px 12px rgba(15,38,71,0.04)" }}>
      {children}
    </div>
  );
}

export function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<any>(null);
  const [contactos, setContactos] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);

  useEffect(() => {
    if (id) cargar(id);
  }, [id]);

  async function cargar(customerId: string) {
    const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
    setCliente(c);
    const { data: cont } = await supabase.from("customer_contacts").select("*").eq("customer_id", customerId);
    setContactos(cont ?? []);
    const { data: vis } = await supabase
      .from("visits")
      .select("id, visit_date, result, interest_level, user_id, profiles(full_name)")
      .eq("customer_id", customerId)
      .order("visit_date", { ascending: false });
    setVisitas(vis ?? []);
    const { data: op } = await supabase.from("opportunities").select("*").eq("customer_id", customerId);
    setOportunidades(op ?? []);
    const { data: prod } = await supabase
      .from("customer_products")
      .select("*")
      .eq("customer_id", customerId);
    setProductos(prod ?? []);
  }

  if (!cliente) {
    return (
      <Layout title="Cliente">
        <div className="text-sm text-[#5B6670]">Cargando...</div>
      </Layout>
    );
  }

  return (
    <Layout title={cliente.name}>
      <button onClick={() => navigate("/clientes")} className="flex items-center gap-1.5 text-sm mb-4 text-[#5B6670]">
        <ChevronLeft size={16} /> Volver a clientes
      </button>

      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-5">
          <Card>
            <div className="text-xs uppercase tracking-wide mb-2 text-[#5B6670]">Datos del negocio</div>
            <div className="text-lg font-semibold mb-1 text-[#0F2647]">{cliente.name}</div>
            <div className="text-sm text-[#5B6670]">{(cliente.business_types ?? []).join(" + ")}</div>
            <div className="text-sm flex items-center gap-1 mt-1 text-[#5B6670]">
              <MapPin size={13} /> {cliente.zone}, {cliente.city}
            </div>
          </Card>

          <Card>
            <div className="text-xs uppercase tracking-wide mb-3 text-[#5B6670]">Contactos</div>
            <div className="space-y-3">
              {contactos.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#0F2647]">{c.name}</div>
                    <div className="text-xs text-[#5B6670]">{c.position}</div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${c.phone}`} className="w-8 h-8 rounded-full flex items-center justify-center bg-[#EEF0F2] text-[#1B3A6B]">
                      <Phone size={14} />
                    </a>
                    <a
                      href={`https://wa.me/${c.whatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-[#E3EFE7] text-[#3E7A56]"
                    >
                      <MessageCircle size={14} />
                    </a>
                  </div>
                </div>
              ))}
              {contactos.length === 0 && <div className="text-xs italic text-[#5B6670]">Sin contactos registrados.</div>}
            </div>
          </Card>

          <Card>
            <div className="text-xs uppercase tracking-wide mb-3 text-[#5B6670]">Oportunidades</div>
            <div className="space-y-2">
              {oportunidades.map((o) => {
                const estado = estadoOportunidad[o.estado];
                return (
                  <div key={o.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: "#F1F2F4" }}>
                    <div>
                      <div className="font-medium text-[#0F2647]">{o.title}</div>
                      <div className="text-xs font-mono text-[#5B6670]">
                        {o.valor_estimado ? `Bs ${o.valor_estimado} · ${o.probabilidad ?? 0}%` : "—"}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: estado?.color }} />
                      {estado?.label}
                    </span>
                  </div>
                );
              })}
              {oportunidades.length === 0 && <div className="text-xs italic text-[#5B6670]">Sin oportunidades registradas.</div>}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="text-xs uppercase tracking-wide mb-3 text-[#5B6670]">Historial de visitas</div>
            <div className="space-y-2">
              {visitas.map((v) => (
                <div key={v.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: "#F1F2F4" }}>
                  <div>
                    <div className="text-sm text-[#0F2647]">{v.result}</div>
                    <div className="text-xs text-[#5B6670]">
                      {new Date(v.visit_date).toLocaleDateString("es-BO")} · {v.profiles?.full_name}
                    </div>
                  </div>
                  {v.interest_level && (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: interesColor[v.interest_level] }} />
                      {v.interest_level}
                    </span>
                  )}
                </div>
              ))}
              {visitas.length === 0 && <div className="text-xs italic text-[#5B6670]">Sin visitas registradas.</div>}
            </div>
          </Card>

          <Card>
            <div className="text-xs uppercase tracking-wide mb-3 text-[#5B6670]">Productos que consume</div>
            <div className="space-y-2">
              {productos.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: "#F1F2F4" }}>
                  <div className="font-medium text-[#0F2647]">{p.description}</div>
                  <div className="text-xs text-[#5B6670]">
                    {p.frequency} · {p.usual_brand}
                  </div>
                </div>
              ))}
              {productos.length === 0 && <div className="text-xs italic text-[#5B6670]">Sin productos registrados.</div>}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
