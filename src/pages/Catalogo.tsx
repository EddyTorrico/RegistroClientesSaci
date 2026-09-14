import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { supabase } from "../lib/supabase";

export function Catalogo() {
  const [categorias, setCategorias] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [categoriaId, setCategoriaId] = useState<string>("Todas");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const { data: cats } = await supabase.from("categories").select("*").order("name");
    setCategorias(cats ?? []);
    const { data: prods } = await supabase
      .from("products")
      .select("id, sku, name, description, brand, category_id, product_prices(price_type, price, currency)")
      .eq("active", true);
    setProductos(prods ?? []);
  }

  const visibles = productos.filter((p) => categoriaId === "Todas" || p.category_id === categoriaId);

  return (
    <Layout title="Catálogo">
      <div className="grid grid-cols-4 gap-5">
        <div className="col-span-1">
          <div className="text-xs uppercase tracking-wide mb-2 text-[#5B6670]">Categorías</div>
          <div className="flex flex-col gap-1">
            <button onClick={() => setCategoriaId("Todas")} className={`text-left px-3 py-1.5 rounded-lg text-sm ${categoriaId === "Todas" ? "bg-[#1B3A6B] text-white" : "text-[#5B6670]"}`}>
              Todas
            </button>
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setCategoriaId(c.id)} className={`text-left px-3 py-1.5 rounded-lg text-sm ${categoriaId === c.id ? "bg-[#1B3A6B] text-white" : "text-[#5B6670]"}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-3">
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06), 0 1px 12px rgba(15,38,71,0.04)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide border-b text-[#5B6670]" style={{ borderColor: "#ECEEF1" }}>
                  <th className="py-2">SKU</th>
                  <th className="py-2">Producto</th>
                  <th className="py-2">Marca</th>
                  <th className="py-2">Precios</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id} className="border-b" style={{ borderColor: "#F1F2F4" }}>
                    <td className="py-2.5 font-mono text-xs text-[#5B6670]">{p.sku}</td>
                    <td className="py-2.5 font-medium text-[#0F2647]">{p.name}<div className="text-xs text-[#5B6670]">{p.description}</div></td>
                    <td className="py-2.5 text-[#5B6670]">{p.brand || "—"}</td>
                    <td className="py-2.5 text-xs text-[#5B6670]">
                      {(p.product_prices ?? []).map((pr: any) => `${pr.price_type}: ${pr.currency} ${pr.price}`).join(" · ")}
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center italic text-[#5B6670]">Sin productos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
