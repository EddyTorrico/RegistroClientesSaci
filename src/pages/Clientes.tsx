import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Search, Plus } from "lucide-react";

export function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [zonas, setZonas] = useState<string[]>(["Todas"]);
  const [filtroZona, setFiltroZona] = useState("Todas");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const { data } = await supabase
      .from("customers")
      .select("id, name, zone, city, business_types")
      .order("name");
    setClientes(data ?? []);
    const zonasUnicas = Array.from(new Set((data ?? []).map((c: any) => c.zone).filter(Boolean)));
    setZonas(["Todas", ...zonasUnicas]);
  }

  const visibles = clientes.filter((c) => {
    const okNombre = c.name?.toLowerCase().includes(busqueda.toLowerCase());
    const okZona = filtroZona === "Todas" || c.zone === filtroZona;
    return okNombre && okZona;
  });

  return (
    <Layout title="Clientes">
      <div className="grid grid-cols-4 gap-5">
        <div className="col-span-1 space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm bg-white"
              style={{ borderColor: "#E2E5EA" }}
            />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide mb-2 text-[#5B6670]">Zona</div>
            <div className="flex flex-col gap-1">
              {zonas.map((z) => (
                <button
                  key={z}
                  onClick={() => setFiltroZona(z)}
                  className={`text-left px-3 py-1.5 rounded-lg text-sm ${filtroZona === z ? "bg-[#1B3A6B] text-white" : "text-[#5B6670]"}`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => navigate("/visitas/nueva")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white bg-[#1B3A6B]"
          >
            <Plus size={15} /> Nuevo cliente
          </button>
        </div>

        <div className="col-span-3">
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06), 0 1px 12px rgba(15,38,71,0.04)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide border-b text-[#5B6670]" style={{ borderColor: "#ECEEF1" }}>
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Zona</th>
                  <th className="py-2">Ciudad</th>
                  <th className="py-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                    className="border-b cursor-pointer hover:bg-[#F5F6F8]"
                    style={{ borderColor: "#F1F2F4" }}
                  >
                    <td className="py-2.5 font-medium text-[#0F2647]">{c.name}</td>
                    <td className="py-2.5 text-[#5B6670]">{c.zone ?? "—"}</td>
                    <td className="py-2.5 text-[#5B6670]">{c.city ?? "—"}</td>
                    <td className="py-2.5 text-[#5B6670]">{(c.business_types ?? []).join(", ")}</td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center italic text-[#5B6670]">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
