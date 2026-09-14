import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { Plus, Trash2, Printer, Search, ShoppingCart, Check } from "lucide-react";

const COMPANY = {
  name: "SACIPETROL S.R.L.",
  address: "POLANCO # 11 JOSE SERRATE OF. 1, SANTA CRUZ - BOLIVIA",
  phones: "71336165 - 75015157",
  email: "gerencia@sacipetrol.com",
  web: "www.sacipetrol.com",
};

export function Cotizaciones() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customer, setCustomer] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [search, setSearch] = useState("");
  const [valid, setValid] = useState("15");
  const [delivery, setDelivery] = useState("Inmediata");
  const [payment, setPayment] = useState("Contado");
  const [discount, setDiscount] = useState("0");
  const [observations, setObservations] = useState("");
  const [saved, setSaved] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      setSellerId(profile.id);
      load();
    }
  }, [profile?.id]);

  async function load() {
    setError("");
    const [customersResult, productsResult, sellersResult] = await Promise.all([
      supabase.from("customers").select("id,name").order("name"),
      supabase.from("product_inventory").select("product_id,sku,name,unit,sale_price,stock,active,image_url").eq("active", true).order("name"),
      supabase.from("profiles").select("id,full_name,role,active").eq("active", true).order("full_name"),
    ]);

    if (customersResult.error) setError(customersResult.error.message);
    else if (productsResult.error) setError(productsResult.error.message);
    else if (sellersResult.error) setError(sellersResult.error.message);

    setCustomers(customersResult.data ?? []);
    setProducts(productsResult.data ?? []);
    setSellers(sellersResult.data ?? []);
  }

  function resetQuotation() {
    setSaved(null);
    setItems([]);
    setCustomer("");
    setSellerId(profile?.id ?? "");
    setSearch("");
    setValid("15");
    setDelivery("Inmediata");
    setPayment("Contado");
    setDiscount("0");
    setObservations("");
    setError("");
  }

  function add(p: any) {
    setError("");
    if (Number(p.stock) <= 0) {
      setError("El producto no tiene stock disponible.");
      return;
    }
    if (items.some(x => x.product_id === p.product_id)) return;
    setItems([...items, {
      product_id: p.product_id,
      sku: p.sku,
      description: p.name,
      quantity: 1,
      unit_price: Number(p.sale_price || 0),
      discount: 0,
      stock: Number(p.stock),
      unit: p.unit || "unidad",
    }]);
  }

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(p => `${p.sku} ${p.name}`.toLowerCase().includes(needle));
  }, [products, search]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price - i.discount, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const selectedSeller = sellers.find(s => s.id === sellerId) ?? (profile?.id === sellerId ? profile : null);
  const selectedCustomer = customers.find(c => c.id === customer);

  async function save() {
    setError("");
    if (!profile || !customer || !sellerId || !items.length) {
      setError("Selecciona cliente, vendedor y al menos un producto.");
      return;
    }

    for (const i of items) {
      if (Number(i.quantity) <= 0) {
        setError(`La cantidad de ${i.sku} debe ser mayor a cero.`);
        return;
      }
      if (Number(i.quantity) > Number(i.stock)) {
        setError(`Stock insuficiente para ${i.sku}. Disponible: ${i.stock}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() + Number(valid || 0));

      const { data: q, error: e } = await supabase.from("quotations").insert({
        customer_id: customer,
        user_id: sellerId,
        valid_until: d.toISOString().slice(0, 10),
        delivery_time: delivery,
        payment_terms: payment,
        observations: observations.trim() || null,
        subtotal,
        discount: Number(discount || 0),
        total,
        status: "emitida",
      }).select().single();
      if (e) throw e;

      const { error: ie } = await supabase.from("quotation_items").insert(items.map(i => ({
        quotation_id: q.id,
        product_id: i.product_id,
        sku: i.sku,
        description: i.description,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        discount: Number(i.discount || 0),
        subtotal: Number(i.quantity) * Number(i.unit_price) - Number(i.discount || 0),
      })));
      if (ie) throw ie;

      setSaved(q);
    } catch (e: any) {
      setError(e.message || "No fue posible guardar la cotización.");
    } finally {
      setLoading(false);
    }
  }

  return <Layout title="Cotizaciones" subtitle="Selecciona productos, vendedor y genera una cotización imprimible">
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <button onClick={resetQuotation} className="px-4 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm"><Plus size={15} className="inline mr-1"/>Nueva cotización</button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 print:hidden">{error}</div>}

      {saved ? (
        <div className="bg-white rounded-2xl p-8 max-w-5xl mx-auto print:shadow-none print:p-0">
          <div className="flex justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-xl font-bold">{COMPANY.name}</h2>
              <div className="text-xs text-[#5B6670]">{COMPANY.address}<br/>{COMPANY.phones}<br/>{COMPANY.email} · {COMPANY.web}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">COTIZACIÓN</div>
              <div>{saved.quotation_number}</div>
              <div>{saved.quotation_date}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 py-5 text-sm">
            <div>Cliente: <b>{selectedCustomer?.name}</b></div>
            <div>Vendedor / Usuario: <b>{selectedSeller?.full_name || profile?.full_name}</b></div>
          </div>

          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-2">Ítem</th><th>Código</th><th>Descripción</th><th>Cant.</th><th>Unidad</th><th>Precio Unit.</th><th>Total</th></tr></thead>
            <tbody>{items.map((i, n) => <tr key={i.product_id} className="border-b"><td className="py-2">{n + 1}</td><td>{i.sku}</td><td>{i.description}</td><td>{i.quantity}</td><td>{i.unit}</td><td>Bs {Number(i.unit_price).toFixed(2)}</td><td>Bs {(i.quantity * i.unit_price - i.discount).toFixed(2)}</td></tr>)}</tbody>
          </table>

          <div className="mt-4 ml-auto max-w-xs text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal:</span><b>Bs {subtotal.toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Descuento:</span><b>Bs {Number(discount || 0).toFixed(2)}</b></div>
            <div className="flex justify-between text-base border-t pt-2"><span>Total General:</span><b>Bs {total.toFixed(2)}</b></div>
          </div>

          <div className="mt-6 text-xs space-y-1">
            <div><b>Validez de la oferta:</b> {valid} días calendario</div>
            <div><b>Tiempo de entrega:</b> {delivery}</div>
            <div><b>Forma de pago:</b> {payment}</div>
            {observations && <div className="pt-2"><b>Observaciones:</b><br/>{observations}</div>}
          </div>

          <div className="mt-6 print:hidden flex gap-2 justify-end">
            <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white"><Printer size={16} className="inline mr-2"/>Imprimir / Guardar PDF</button>
          </div>
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs text-[#5B6670]">Cliente
                <select value={customer} onChange={e => setCustomer(e.target.value)} className="w-full border rounded-xl p-2.5 mt-1 text-sm">
                  <option value="">Seleccionar cliente...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              <label className="text-xs text-[#5B6670]">Vendedor / usuario que realiza la cotización
                <select value={sellerId} onChange={e => setSellerId(e.target.value)} className="w-full border rounded-xl p-2.5 mt-1 text-sm">
                  <option value="">Seleccionar vendedor...</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.full_name} · {s.role}</option>)}
                </select>
              </label>
            </div>

            <div>
              <div className="text-sm font-semibold text-[#0F2647] mb-2">Seleccionar productos</div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]"/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código o descripción..." className="w-full border rounded-xl py-2.5 pl-9 pr-3 text-sm"/>
              </div>
            </div>

            <div className="border rounded-xl divide-y max-h-[480px] overflow-auto">
              {filteredProducts.map(p => {
                const selected = items.some(i => i.product_id === p.product_id);
                const noStock = Number(p.stock) <= 0;
                return <div key={p.product_id} className="p-3 flex gap-3 items-center hover:bg-[#FAFBFC]">
                  <div className="w-12 h-12 shrink-0 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-contain"/> : <ShoppingCart size={17} className="text-[#9AA4AF]"/>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-[#0F2647]">{p.sku}</div>
                    <div className="text-xs text-[#5B6670] line-clamp-2">{p.name}</div>
                    <div className="text-xs mt-1">Bs {Number(p.sale_price || 0).toFixed(2)} · Stock: <b className={noStock ? "text-red-600" : "text-[#3E7A56]"}>{Number(p.stock).toFixed(2)}</b></div>
                  </div>
                  <button disabled={selected || noStock} onClick={() => add(p)} className={`px-3 py-2 rounded-lg text-xs shrink-0 ${selected ? "bg-green-50 text-green-700" : noStock ? "bg-gray-100 text-gray-400" : "bg-[#1B3A6B] text-white"}`}>
                    {selected ? <><Check size={14} className="inline mr-1"/>Agregado</> : noStock ? "Sin stock" : "Agregar"}
                  </button>
                </div>;
              })}
              {filteredProducts.length === 0 && <div className="p-8 text-center text-sm italic text-[#5B6670]">No se encontraron productos.</div>}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Productos de la cotización ({items.length})</h3>

            {items.length === 0 && <div className="border border-dashed rounded-xl p-8 text-center text-sm text-[#5B6670]">Selecciona uno o más productos del listado de la izquierda.</div>}

            {items.map((i, idx) => <div key={i.product_id} className="border-b py-3">
              <div className="flex justify-between gap-3 text-sm">
                <span><b>{i.sku}</b> · {i.description}</span>
                <button title="Quitar producto" onClick={() => setItems(items.filter((_, x) => x !== idx))}><Trash2 size={16} className="text-red-600"/></button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <label className="text-[11px] text-[#5B6670]">Cantidad<input type="number" min="1" max={i.stock} value={i.quantity} onChange={e => setItems(items.map((x, n) => n === idx ? { ...x, quantity: Number(e.target.value) } : x))} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
                <label className="text-[11px] text-[#5B6670]">Precio unitario<input type="number" min="0" step="0.01" value={i.unit_price} onChange={e => setItems(items.map((x, n) => n === idx ? { ...x, unit_price: Number(e.target.value) } : x))} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
                <div className="text-[11px] text-[#5B6670]">Total<div className="text-sm p-2 mt-1 font-medium">Bs {(i.quantity * i.unit_price - i.discount).toFixed(2)}</div></div>
              </div>
              <div className="text-xs text-[#5B6670] mt-1">Disponible: {i.stock} {i.unit}</div>
            </div>)}

            <div className="grid md:grid-cols-3 gap-2 mt-4">
              <label className="text-xs text-[#5B6670]">Validez (días)<input type="number" min="0" value={valid} onChange={e => setValid(e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
              <label className="text-xs text-[#5B6670]">Tiempo de entrega<input value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
              <label className="text-xs text-[#5B6670]">Forma de pago<input value={payment} onChange={e => setPayment(e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
            </div>

            <label className="block text-xs text-[#5B6670] mt-3">Descuento general (Bs)<input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
            <label className="block text-xs text-[#5B6670] mt-3">Observaciones<textarea rows={3} value={observations} onChange={e => setObservations(e.target.value)} placeholder="Condiciones, aclaraciones o comentarios para el cliente..." className="w-full border rounded-lg p-2 text-sm mt-1"/></label>

            <div className="mt-4 border-t pt-4 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>Bs {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Descuento</span><span>Bs {Number(discount || 0).toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span>Bs {total.toFixed(2)}</span></div>
            </div>

            <button disabled={loading} onClick={save} className="w-full mt-4 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{loading ? "Guardando..." : "Guardar cotización"}</button>
            <div className="text-xs text-[#5B6670] mt-2 text-center">Después de guardar aparecerá la opción <b>Imprimir / Guardar PDF</b>.</div>
          </div>
        </div>
      )}
    </div>
  </Layout>;
}
