import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { Plus, Trash2, Printer, Search, ShoppingCart, Check, Eye, FileText, ShoppingBag, Pencil, PackagePlus } from "lucide-react";

const COMPANY = {
  name: "SACIPETROL S.R.L.",
  address: "POLANCO # 11 JOSE SERRATE OF. 1, SANTA CRUZ - BOLIVIA",
  phones: "71336165 - 75015157",
  email: "gerencia@sacipetrol.com",
  web: "www.sacipetrol.com",
};

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormatter = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function money(value: number | string | null | undefined) {
  return moneyFormatter.format(Number(value || 0));
}

function qty(value: number | string | null | undefined) {
  return qtyFormatter.format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat("es-BO").format(new Date(y, m - 1, d));
}

export function Cotizaciones() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isAdmin = profile?.role === "admin";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProjectLinked, setEditingProjectLinked] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customer, setCustomer] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [search, setSearch] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [valid, setValid] = useState("15");
  const [delivery, setDelivery] = useState("Inmediata");
  const [deliveryPreset, setDeliveryPreset] = useState("Inmediata");
  const [payment, setPayment] = useState("Contado");
  const [discount, setDiscount] = useState("0");
  const [observations, setObservations] = useState("");
  const [saved, setSaved] = useState<any>(null);
  const [screen, setScreen] = useState<"list" | "new" | "view">("list");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingView, setLoadingView] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ description: "", clientCode: "", unit: "unidad", quantity: "1", unitPrice: "0" });

  useEffect(() => {
    if (profile?.id) {
      setSellerId(profile.id);
      load();
    }
  }, [profile?.id]);

  // Enlace directo desde el Tablero (?ver=<id>): abre esa cotización en modo
  // consulta apenas se cargó el listado.
  useEffect(() => {
    const verId = params.get("ver");
    if (verId && quotations.length) {
      const q = quotations.find(x => x.id === verId);
      if (q) viewQuotation(q);
      setParams({});
    }
  }, [quotations.length, params]);

  async function load() {
    setError("");
    const [customersResult, productsResult, sellersResult, quotationsResult] = await Promise.all([
      supabase.from("customers").select("id,name,address,city,zone,phone").order("name"),
      supabase.from("product_inventory").select("product_id,sku,name,brand,unit,sale_price,stock,active,image_url").eq("active", true).eq("is_project_product", false).order("name"),
      supabase.from("profiles").select("id,full_name,role,active").eq("active", true).order("full_name"),
      supabase.from("quotations").select("id,quotation_number,customer_id,user_id,quotation_date,valid_until,delivery_time,payment_terms,observations,customer_address,status,subtotal,discount,total,created_at").order("created_at", { ascending: false }),
    ]);

    if (customersResult.error) setError(customersResult.error.message);
    else if (productsResult.error) setError(productsResult.error.message);
    else if (sellersResult.error) setError(sellersResult.error.message);
    else if (quotationsResult.error) setError(quotationsResult.error.message);

    setCustomers(customersResult.data ?? []);
    setProducts(productsResult.data ?? []);
    setSellers(sellersResult.data ?? []);
    setQuotations(quotationsResult.data ?? []);
  }

  async function reloadQuotations() {
    const { data, error: e } = await supabase
      .from("quotations")
      .select("id,quotation_number,customer_id,user_id,quotation_date,valid_until,delivery_time,payment_terms,observations,customer_address,status,subtotal,discount,total,created_at")
      .order("created_at", { ascending: false });
    if (e) setError(e.message);
    else setQuotations(data ?? []);
  }

  function resetQuotation() {
    setSaved(null);
    setItems([]);
    setCustomer("");
    setSellerId(profile?.id ?? "");
    setSearch("");
    setValid("15");
    setDelivery("Inmediata");
    setDeliveryPreset("Inmediata");
    setPayment("Contado");
    setDiscount("0");
    setObservations("");
    setError("");
    setEditingId(null);
    setEditingProjectLinked(false);
    setScreen("new");
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
      client_item_code: "",
      description: p.name,
      brand: p.brand || "",
      quantity: 1,
      unit_price: Number(p.sale_price || 0),
      discount: 0,
      stock: Number(p.stock),
      unit: p.unit || "unidad",
      delivery_date: "",
    }]);
  }

  function addManual() {
    setError("");
    if (!manual.description.trim()) {
      setError("Describe el ítem a cotizar.");
      return;
    }
    setItems([...items, {
      product_id: null,
      sku: null,
      client_item_code: manual.clientCode.trim() || "",
      description: manual.description.trim(),
      brand: "",
      quantity: Number(manual.quantity || 1),
      unit_price: Number(manual.unitPrice || 0),
      discount: 0,
      stock: undefined,
      unit: manual.unit.trim() || "unidad",
      delivery_date: "",
    }]);
    setManual({ description: "", clientCode: "", unit: "unidad", quantity: "1", unitPrice: "0" });
    setShowManual(false);
  }

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(p => `${p.sku} ${p.name} ${p.brand || ""}`.toLowerCase().includes(needle));
  }, [products, search]);

  const filteredQuotations = useMemo(() => {
    const needle = quoteSearch.trim().toLowerCase();
    if (!needle) return quotations;
    return quotations.filter(q => String(q.quotation_number || "").toLowerCase().includes(needle));
  }, [quotations, quoteSearch]);

  const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount || 0), 0);
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
        setError(`La cantidad de ${i.sku || i.description} debe ser mayor a cero.`);
        return;
      }
      // Los ítems sin producto de catálogo (product_id vacío) son propuestas —
      // no tienen stock que validar; solo se exige stock a los que sí vienen
      // de un producto real del catálogo.
      if (i.product_id && Number(i.quantity) > Number(i.stock) && !i.is_project_pending && !editingProjectLinked) {
        setError(`Stock insuficiente para ${i.sku}. Disponible: ${qty(i.stock)}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() + Number(valid || 0));

      if (editingId) {
        const { data: q, error: e } = await supabase.from("quotations").update({
          customer_id: customer,
          user_id: sellerId,
          customer_address: selectedCustomer?.address?.trim() || null,
          valid_until: d.toISOString().slice(0, 10),
          delivery_time: delivery,
          payment_terms: payment,
          observations: observations.trim() || null,
          subtotal,
          discount: Number(discount || 0),
          total,
        }).eq("id", editingId).select().single();
        if (e) throw e;

        const { error: de } = await supabase.from("quotation_items").delete().eq("quotation_id", editingId);
        if (de) throw de;

        const { error: ie } = await supabase.from("quotation_items").insert(items.map(i => ({
          quotation_id: editingId,
          product_id: i.product_id || null,
          sku: i.sku || null,
          client_item_code: i.client_item_code?.trim() || null,
          description: i.description,
          brand: i.brand || null,
          unit: i.unit || "unidad",
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          discount: Number(i.discount || 0),
          subtotal: Number(i.quantity) * Number(i.unit_price) - Number(i.discount || 0),
          delivery_date: i.delivery_date || null,
        })));
        if (ie) throw ie;

        setSaved(q);
        setEditingId(null);
        setScreen("view");
        await reloadQuotations();
      } else {
        const { data: q, error: e } = await supabase.from("quotations").insert({
          customer_id: customer,
          user_id: sellerId,
          customer_address: selectedCustomer?.address?.trim() || null,
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
          product_id: i.product_id || null,
          sku: i.sku || null,
          client_item_code: i.client_item_code?.trim() || null,
          description: i.description,
          brand: i.brand || null,
          unit: i.unit || "unidad",
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          discount: Number(i.discount || 0),
          subtotal: Number(i.quantity) * Number(i.unit_price) - Number(i.discount || 0),
          delivery_date: i.delivery_date || null,
        })));
        if (ie) throw ie;

        setSaved(q);
        setScreen("view");
        await reloadQuotations();
      }
    } catch (e: any) {
      setError(e.message || "No fue posible guardar la cotización.");
    } finally {
      setLoading(false);
    }
  }

  async function editQuotation(q: any) {
    setError("");
    setLoadingView(true);
    try {
      const { data: quoteItems, error: itemError } = await supabase
        .from("quotation_items")
        .select("id,quotation_id,product_id,sku,client_item_code,description,brand,unit,quantity,unit_price,discount,subtotal,delivery_date")
        .eq("quotation_id", q.id)
        .order("id");
      if (itemError) throw itemError;

      // Si esta cotización pertenece a un proyecto (Proyectos → Cotización /
      // Venta), es una propuesta para una licitación/pedido especial que
      // todavía puede no estar comprado — no se le exige stock disponible
      // para poder actualizarla. El stock sí se exige al convertirla en
      // venta (Ventas), que es cuando de verdad sale del inventario.
      const { data: linkedProject } = await supabase.from("projects").select("id").eq("quotation_id", q.id).maybeSingle();
      setEditingProjectLinked(!!linkedProject);

      // Se busca el stock/estado real en product_inventory (no en el listado
      // filtrado "products", que ya excluye los productos de proyecto aún
      // pendientes de compra) para saber, ítem por ítem, si corresponde
      // exigirle stock disponible al guardar los cambios.
      const productIds = Array.from(new Set((quoteItems ?? []).map((i: any) => i.product_id).filter(Boolean)));
      let liveProducts: any[] = [];
      if (productIds.length) {
        const { data } = await supabase
          .from("product_inventory")
          .select("product_id,brand,unit,stock,is_project_product")
          .in("product_id", productIds);
        liveProducts = data ?? [];
      }

      const normalizedItems = (quoteItems ?? []).map((i: any) => {
        const p = products.find((x: any) => x.product_id === i.product_id);
        const live = liveProducts.find((x: any) => x.product_id === i.product_id);
        return {
          ...i,
          brand: i.brand || p?.brand || live?.brand || "",
          unit: i.unit || p?.unit || live?.unit || "unidad",
          stock: Number(live?.stock ?? p?.stock ?? 0),
          // Ítem de un proyecto que todavía no tuvo una compra real registrada:
          // no se le exige stock disponible para poder actualizar la cotización
          // (recién se compra si/cuando se gana el proyecto).
          is_project_pending: !!live?.is_project_product,
        };
      });

      setEditingId(q.id);
      setSaved(null);
      setCustomer(q.customer_id);
      setSellerId(q.user_id);
      setSearch("");
      setValid("15");
      setDelivery(q.delivery_time || "Inmediata");
      setDeliveryPreset(["Inmediata", "5 días", "10 días", "15 días"].includes(q.delivery_time) ? q.delivery_time : "Personalizada");
      setPayment(q.payment_terms || "Contado");
      setDiscount(String(q.discount ?? 0));
      setObservations(q.observations || "");
      setItems(normalizedItems);
      setScreen("new");
    } catch (e: any) {
      setError(e.message || "No fue posible abrir la cotización para editar.");
    } finally {
      setLoadingView(false);
    }
  }

  async function deleteQuotation(q: any) {
    setError("");
    let warning = "";
    try {
      const { data: linkedProject } = await supabase.from("projects").select("id,project_number").eq("quotation_id", q.id).maybeSingle();
      if (linkedProject) warning = ` Esta cotización está vinculada al proyecto ${linkedProject.project_number}; si la eliminas, el proyecto quedará sin cotización vinculada.`;
    } catch {
      // el módulo Proyectos puede no estar instalado todavía; se ignora la verificación.
    }
    if (!window.confirm(`¿Eliminar la cotización ${q.quotation_number}?${warning} Esta acción no se puede deshacer.`)) return;
    const { error: e } = await supabase.from("quotations").delete().eq("id", q.id);
    if (e) { setError(e.message); return; }
    if (saved?.id === q.id) { setSaved(null); setScreen("list"); }
    await reloadQuotations();
  }

  async function viewQuotation(q: any, printAfter = false) {
    setError("");
    setLoadingView(true);
    try {
      const { data: quoteItems, error: itemError } = await supabase
        .from("quotation_items")
        .select("id,quotation_id,product_id,sku,client_item_code,description,brand,unit,quantity,unit_price,discount,subtotal,delivery_date")
        .eq("quotation_id", q.id)
        .order("id");
      if (itemError) throw itemError;

      const missingProductIds = Array.from(new Set((quoteItems ?? [])
        .filter((i: any) => !i.brand || !i.unit)
        .map((i: any) => i.product_id)
        .filter(Boolean)));

      let fallbackProducts: any[] = [];
      if (missingProductIds.length) {
        const { data, error: pe } = await supabase
          .from("products")
          .select("id,brand,unit")
          .in("id", missingProductIds);
        if (pe) throw pe;
        fallbackProducts = data ?? [];
      }

      const normalizedItems = (quoteItems ?? []).map((i: any) => {
        const fp = fallbackProducts.find(p => p.id === i.product_id);
        return {
          ...i,
          brand: i.brand || fp?.brand || "",
          unit: i.unit || fp?.unit || "unidad",
          stock: 0,
        };
      });

      setSaved(q);
      setCustomer(q.customer_id);
      setSellerId(q.user_id);
      setDelivery(q.delivery_time || "—");
      setDeliveryPreset(["Inmediata","5 días","10 días","15 días"].includes(q.delivery_time) ? q.delivery_time : "Personalizada");
      setPayment(q.payment_terms || "—");
      setDiscount(String(q.discount ?? 0));
      setObservations(q.observations || "");
      setItems(normalizedItems);
      setScreen("view");

      if (printAfter) {
        setTimeout(() => window.print(), 120);
      }
    } catch (e: any) {
      setError(e.message || "No fue posible abrir la cotización.");
    } finally {
      setLoadingView(false);
    }
  }

  const customerAddress = saved?.customer_address || selectedCustomer?.address || "—";

  return <Layout title="Cotizaciones" subtitle="Crea, consulta e imprime cotizaciones comerciales">
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2 print:hidden">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setScreen("list"); setSaved(null); setEditingId(null); }} className={`px-4 py-2.5 rounded-xl text-sm border ${screen === "list" ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#0F2647]"}`}><FileText size={15} className="inline mr-1"/>Cotizaciones guardadas</button>
          <button onClick={resetQuotation} className={`px-4 py-2.5 rounded-xl text-sm border ${screen === "new" ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#0F2647]"}`}><Plus size={15} className="inline mr-1"/>Nueva cotización</button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 print:hidden">{error}</div>}

      {screen === "list" && (
        <div className="bg-white rounded-2xl p-5 print:hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-[#0F2647]">Cotizaciones guardadas</h2>
              <div className="text-xs text-[#5B6670]">Busca por código de cotización y vuelve a abrirla para consulta o impresión.</div>
            </div>
            <div className="relative md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]"/>
              <input value={quoteSearch} onChange={e => setQuoteSearch(e.target.value)} placeholder="Buscar código: COT-2026-..." className="w-full border rounded-xl py-2.5 pl-9 pr-3 text-sm"/>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Código</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Acciones</th></tr></thead>
              <tbody>
                {filteredQuotations.map(q => {
                  const c = customers.find(x => x.id === q.customer_id);
                  const s = sellers.find(x => x.id === q.user_id);
                  return <tr key={q.id} className="border-b hover:bg-[#FAFBFC]">
                    <td className="py-3 font-mono text-xs font-semibold">{q.quotation_number}</td>
                    <td>{formatDate(q.quotation_date)}</td>
                    <td>{c?.name || "—"}</td>
                    <td>{s?.full_name || "—"}</td>
                    <td><span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">{q.status}</span></td>
                    <td className="text-right font-semibold">Bs {money(q.total)}</td>
                    <td><div className="flex justify-end gap-2">
                      <button disabled={loadingView} title="Ver cotización" onClick={() => viewQuotation(q)} className="p-2 rounded-lg border text-[#1B3A6B]"><Eye size={15}/></button>
                      <button disabled={loadingView} title="Imprimir cotización" onClick={() => viewQuotation(q, true)} className="p-2 rounded-lg border text-[#1B3A6B]"><Printer size={15}/></button>
                      <button disabled={loadingView} title="Actualizar cotización" onClick={() => editQuotation(q)} className="p-2 rounded-lg border text-[#1B3A6B]"><Pencil size={15}/></button>
                      <button title="Convertir a venta" onClick={() => navigate(`/ventas?quotation=${q.id}`)} className="p-2 rounded-lg border text-[#1B3A6B]"><ShoppingBag size={15}/></button>
                      {isAdmin && <button title="Eliminar cotización" onClick={() => deleteQuotation(q)} className="p-2 rounded-lg border text-red-600"><Trash2 size={15}/></button>}
                    </div></td>
                  </tr>;
                })}
                {filteredQuotations.length === 0 && <tr><td colSpan={7} className="py-10 text-center italic text-[#5B6670]">No se encontraron cotizaciones.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {screen === "view" && saved && (
        <div className="bg-white rounded-2xl p-4 sm:p-8 max-w-6xl mx-auto print:shadow-none print:p-0">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-xl font-bold">{COMPANY.name}</h2>
              <div className="text-xs text-[#5B6670]">{COMPANY.address}<br/>{COMPANY.phones}<br/>{COMPANY.email} · {COMPANY.web}</div>
            </div>
            <div className="sm:text-right">
              <div className="font-semibold">COTIZACIÓN</div>
              <div className="font-mono font-semibold">{saved.quotation_number}</div>
              <div>{formatDate(saved.quotation_date)}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 py-5 text-sm">
            <div>Cliente: <b>{selectedCustomer?.name || "—"}</b></div>
            <div>Vendedor / Usuario: <b>{selectedSeller?.full_name || "—"}</b></div>
            <div className="md:col-span-2">Dirección del cliente: <b>{customerAddress}</b></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="py-2">Ítem</th><th>Código</th><th>Cód. cliente</th><th>Descripción</th><th>Marca</th><th className="text-right">Cant.</th><th>Unidad</th><th className="text-right">Precio Unit.</th><th className="text-right">Total</th><th>Entrega</th></tr></thead>
              <tbody>{items.map((i, n) => <tr key={i.id || i.product_id || n} className="border-b align-top"><td className="py-2">{n + 1}</td><td className="font-mono text-xs">{i.sku || "—"}</td><td className="font-mono text-xs">{i.client_item_code || "—"}</td><td>{i.description}</td><td>{i.brand || "—"}</td><td className="text-right">{qty(i.quantity)}</td><td>{i.unit}</td><td className="text-right whitespace-nowrap">Bs {money(i.unit_price)}</td><td className="text-right whitespace-nowrap">Bs {money(Number(i.quantity) * Number(i.unit_price) - Number(i.discount || 0))}</td><td className="text-xs whitespace-nowrap">{i.delivery_date ? formatDate(i.delivery_date) : "—"}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto max-w-xs text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal:</span><b>Bs {money(saved.subtotal ?? subtotal)}</b></div>
            <div className="flex justify-between"><span>Descuento:</span><b>Bs {money(saved.discount ?? discount)}</b></div>
            <div className="flex justify-between text-base border-t pt-2"><span>Total General:</span><b>Bs {money(saved.total ?? total)}</b></div>
          </div>

          <div className="mt-6 text-xs space-y-1">
            <div><b>Validez de la oferta hasta:</b> {formatDate(saved.valid_until)}</div>
            <div><b>Tiempo de entrega:</b> {saved.delivery_time || delivery}</div>
            <div><b>Forma de pago:</b> {saved.payment_terms || payment}</div>
            {(saved.observations || observations) && <div className="pt-2"><b>Observaciones:</b><br/>{saved.observations || observations}</div>}
          </div>

          <div className="mt-7 border-t pt-3 text-[11px] text-[#5B6670] italic">
            * El stock está sujeto a modificaciones sin previo aviso.
          </div>

          <div className="mt-6 print:hidden flex flex-wrap gap-2 justify-end">
            <button onClick={() => setScreen("list")} className="px-5 py-2.5 rounded-xl border bg-white text-[#0F2647]">Volver a cotizaciones</button>
            <button onClick={() => editQuotation(saved)} className="px-5 py-2.5 rounded-xl border bg-white text-[#1B3A6B]"><Pencil size={16} className="inline mr-2"/>Actualizar cotización</button>
            <button onClick={() => navigate(`/ventas?quotation=${saved.id}`)} className="px-5 py-2.5 rounded-xl border bg-white text-[#1B3A6B]"><ShoppingBag size={16} className="inline mr-2"/>Convertir a venta</button>
            {isAdmin && <button onClick={() => deleteQuotation(saved)} className="px-5 py-2.5 rounded-xl border border-red-200 bg-white text-red-600"><Trash2 size={16} className="inline mr-2"/>Eliminar</button>}
            <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white"><Printer size={16} className="inline mr-2"/>Imprimir / Guardar PDF</button>
          </div>
        </div>
      )}

      {screen === "new" && (
        <div className="grid xl:grid-cols-2 gap-5 print:hidden">
          {editingId && <div className="xl:col-span-2 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">Estás actualizando una cotización existente. Los cambios reemplazan sus productos y totales al guardar.</div>}
          {editingId && editingProjectLinked && <div className="xl:col-span-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">Esta cotización pertenece a un proyecto — no se exige stock disponible para actualizarla (el stock recién se valida cuando se convierta en venta).</div>}
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

            {selectedCustomer && <div className="text-xs bg-slate-50 border rounded-xl p-3 text-[#5B6670]"><b className="text-[#0F2647]">Dirección:</b> {selectedCustomer.address || "Sin dirección registrada"}</div>}

            <div>
              <div className="text-sm font-semibold text-[#0F2647] mb-2">Seleccionar productos</div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]"/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código, descripción o marca..." className="w-full border rounded-xl py-2.5 pl-9 pr-3 text-sm"/>
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
                    <div className="text-xs text-[#5B6670] mt-0.5">Marca: <b>{p.brand || "—"}</b></div>
                    <div className="text-xs mt-1">Bs {money(p.sale_price)} · Stock: <b className={noStock ? "text-red-600" : "text-[#3E7A56]"}>{qty(p.stock)}</b></div>
                  </div>
                  <button disabled={selected || noStock} onClick={() => add(p)} className={`px-3 py-2 rounded-lg text-xs shrink-0 ${selected ? "bg-green-50 text-green-700" : noStock ? "bg-gray-100 text-gray-400" : "bg-[#1B3A6B] text-white"}`}>
                    {selected ? <><Check size={14} className="inline mr-1"/>Agregado</> : noStock ? "Sin stock" : "Agregar"}
                  </button>
                </div>;
              })}
              {filteredProducts.length === 0 && <div className="p-8 text-center text-sm italic text-[#5B6670]">No se encontraron productos.</div>}
            </div>

            <div className="border-t pt-4">
              {!showManual
                ? <button onClick={() => setShowManual(true)} className="w-full py-2.5 rounded-xl border border-dashed border-[#1B3A6B] text-[#1B3A6B] text-sm"><PackagePlus size={15} className="inline mr-1"/>Cotizar ítem sin producto del catálogo</button>
                : <div className="border rounded-xl p-3 space-y-2 bg-slate-50">
                    <div className="text-xs font-semibold text-[#0F2647]">Ítem sin catálogo</div>
                    <div className="text-[11px] text-[#5B6670]">Para algo que el cliente pide y que todavía no tienes cargado como producto. Se guarda igual, con la descripción que escribas.</div>
                    <input value={manual.description} onChange={e => setManual({ ...manual, description: e.target.value })} placeholder="Descripción del ítem *" className="w-full border rounded-lg p-2 text-sm"/>
                    <input value={manual.clientCode} onChange={e => setManual({ ...manual, clientCode: e.target.value })} placeholder="Código del cliente (opcional)" className="w-full border rounded-lg p-2 text-sm"/>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="number" min="1" value={manual.quantity} onChange={e => setManual({ ...manual, quantity: e.target.value })} placeholder="Cant." className="border rounded-lg p-2 text-sm"/>
                      <input value={manual.unit} onChange={e => setManual({ ...manual, unit: e.target.value })} placeholder="Unidad" className="border rounded-lg p-2 text-sm"/>
                      <input type="number" min="0" step="0.01" value={manual.unitPrice} onChange={e => setManual({ ...manual, unitPrice: e.target.value })} placeholder="Precio unit." className="border rounded-lg p-2 text-sm"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowManual(false)} className="flex-1 py-2 rounded-lg border text-xs">Cancelar</button>
                      <button onClick={addManual} className="flex-1 py-2 rounded-lg bg-[#1B3A6B] text-white text-xs">Agregar a la cotización</button>
                    </div>
                  </div>}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Productos de la cotización ({items.length})</h3>

            {items.length === 0 && <div className="border border-dashed rounded-xl p-8 text-center text-sm text-[#5B6670]">Selecciona uno o más productos del listado de la izquierda.</div>}

            {items.map((i, idx) => <div key={i.id || i.product_id || `manual-${idx}`} className="border-b py-3">
              <div className="flex flex-wrap justify-between gap-3 text-sm">
                <span>{i.sku ? <b>{i.sku}</b> : <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold align-middle mr-1">SIN CATÁLOGO</span>} · {i.description}<span className="block text-xs text-[#5B6670]">Marca: {i.brand || "—"}</span></span>
                <button title="Quitar ítem" onClick={() => setItems(items.filter((_, x) => x !== idx))}><Trash2 size={16} className="text-red-600"/></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <label className="text-[11px] text-[#5B6670]">Cantidad<input type="number" min="1" max={(!i.product_id || i.is_project_pending || editingProjectLinked) ? undefined : i.stock} value={i.quantity} onChange={e => setItems(items.map((x, n) => n === idx ? { ...x, quantity: Number(e.target.value) } : x))} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
                <label className="text-[11px] text-[#5B6670]">Precio unitario<input type="number" min="0" step="0.01" value={i.unit_price} onChange={e => setItems(items.map((x, n) => n === idx ? { ...x, unit_price: Number(e.target.value) } : x))} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
                <div className="text-[11px] text-[#5B6670]">Total<div className="text-sm p-2 mt-1 font-medium">Bs {money(Number(i.quantity) * Number(i.unit_price) - Number(i.discount || 0))}</div></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <label className="text-[11px] text-[#5B6670]">Código del cliente<input value={i.client_item_code || ""} onChange={e => setItems(items.map((x, n) => n === idx ? { ...x, client_item_code: e.target.value } : x))} placeholder="Opcional" className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
                <label className="text-[11px] text-[#5B6670]">Fecha de entrega<input type="date" value={i.delivery_date || ""} onChange={e => setItems(items.map((x, n) => n === idx ? { ...x, delivery_date: e.target.value } : x))} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
              </div>
              {!i.product_id
                ? <div className="text-xs text-[#5B6670] mt-1">Ítem sin producto de catálogo — no requiere stock para cotizarse.</div>
                : i.is_project_pending
                ? <div className="text-xs text-amber-700 mt-1">Producto de proyecto pendiente de compra — todavía no tiene stock real, no se exige disponibilidad para actualizar esta cotización.</div>
                : editingProjectLinked
                ? <div className="text-xs text-[#5B6670] mt-1">Disponible: {qty(i.stock)} {i.unit} — al ser una cotización de proyecto no se exige stock disponible para actualizarla.</div>
                : <div className="text-xs text-[#5B6670] mt-1">Disponible: {qty(i.stock)} {i.unit}</div>}
            </div>)}

            <div className="grid md:grid-cols-3 gap-2 mt-4">
              <label className="text-xs text-[#5B6670]">Validez (días)<input type="number" min="0" value={valid} onChange={e => setValid(e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
              <label className="text-xs text-[#5B6670]">Tiempo de entrega<select value={deliveryPreset} onChange={e => { const v=e.target.value; setDeliveryPreset(v); if(v!=="Personalizada") setDelivery(v); else setDelivery(""); }} className="w-full border rounded-lg p-2 text-sm mt-1"><option>Inmediata</option><option>5 días</option><option>10 días</option><option>15 días</option><option value="Personalizada">Personalizada</option></select>{deliveryPreset === "Personalizada" && <input value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="Ej.: 20 días hábiles" className="w-full border rounded-lg p-2 text-sm mt-2"/>}</label>
              <label className="text-xs text-[#5B6670]">Forma de pago<select value={payment} onChange={e => setPayment(e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1"><option value="Contado">Contado</option><option value="Crédito">Crédito</option></select></label>
            </div>

            <label className="block text-xs text-[#5B6670] mt-3">Descuento general (Bs)<input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1"/></label>
            <label className="block text-xs text-[#5B6670] mt-3">Observaciones<textarea rows={3} value={observations} onChange={e => setObservations(e.target.value)} placeholder="Condiciones, aclaraciones o comentarios para el cliente..." className="w-full border rounded-lg p-2 text-sm mt-1"/></label>

            <div className="mt-4 border-t pt-4 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>Bs {money(subtotal)}</span></div>
              <div className="flex justify-between"><span>Descuento</span><span>Bs {money(discount)}</span></div>
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span>Bs {money(total)}</span></div>
            </div>

            <div className="text-[11px] text-[#5B6670] italic mt-3">* El stock está sujeto a modificaciones sin previo aviso.</div>

            <button disabled={loading} onClick={save} className="w-full mt-4 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{loading ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar cotización"}</button>
            <div className="text-xs text-[#5B6670] mt-2 text-center">Después de guardar aparecerá la opción <b>Imprimir / Guardar PDF</b>.</div>
          </div>
        </div>
      )}
    </div>
  </Layout>;
}
