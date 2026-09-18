import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { BarChart3, Check, Eye, FileText, Plus, Printer, Search, ShoppingCart, Trash2, Truck, AlertTriangle, X, Pencil } from "lucide-react";

const COMPANY = {
  name: "SACIPETROL S.R.L.",
  address: "POLANCO # 11 JOSE SERRATE OF. 1, SANTA CRUZ - BOLIVIA",
  phones: "71336165 - 75015157",
  email: "gerencia@sacipetrol.com",
  web: "www.sacipetrol.com",
};

const moneyFmt = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = (v: any) => moneyFmt.format(Number(v || 0));
const qty = (v: any) => qtyFmt.format(Number(v || 0));
function formatDate(value?: string | null) {
  if (!value) return "—";
  const [y,m,d] = value.slice(0,10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO").format(new Date(y, m - 1, d));
}
function isoToday() { return new Date().toISOString().slice(0,10); }

export function Ventas() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [screen, setScreen] = useState<"list"|"new"|"view"|"report"|"delivery">("list");
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [allSaleItems, setAllSaleItems] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Contado");
  const [deliveryTime, setDeliveryTime] = useState("Inmediata");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [discount, setDiscount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [dueDateOverride, setDueDateOverride] = useState(false);
  const [observations, setObservations] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [saleSearch, setSaleSearch] = useState("");
  const [saved, setSaved] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"dia"|"mes"|"anio">("mes");
  const [reportDate, setReportDate] = useState(isoToday());

  // Edición de vencimiento sobre una venta ya guardada (permite corregir
  // casos como VEN-2026-00004: vencimiento anterior a la fecha de emisión).
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [dueDateDraftOverride, setDueDateDraftOverride] = useState(false);
  const [savingDueDate, setSavingDueDate] = useState(false);

  // Notas de entrega de la venta abierta en "view".
  const [deliveryStatus, setDeliveryStatus] = useState<any[]>([]);
  const [deliveryNotesList, setDeliveryNotesList] = useState<any[]>([]);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryQty, setDeliveryQty] = useState<Record<string,string>>({});
  const [deliveryReceivedBy, setDeliveryReceivedBy] = useState("");
  const [deliveryNotesText, setDeliveryNotesText] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [viewingDeliveryNote, setViewingDeliveryNote] = useState<any>(null);
  const [viewingDeliveryItems, setViewingDeliveryItems] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    setSellerId(profile.id);
    loadAll();
  }, [profile?.id]);

  useEffect(() => {
    const qid = params.get("quotation");
    if (qid && quotations.length) loadQuotation(qid);
  }, [quotations.length, params]);

  // Enlace directo desde el Tablero (?ver=<id>): abre esa venta ya guardada.
  useEffect(() => {
    const verId = params.get("ver");
    if (verId && sales.length) {
      const s = sales.find(x => x.id === verId);
      if (s) viewSale(s);
      setParams(prev => { const p = new URLSearchParams(prev); p.delete("ver"); return p; });
    }
  }, [sales.length, params]);

  async function loadAll() {
    setError("");
    const [c,p,u,s,q,si] = await Promise.all([
      supabase.from("customers").select("id,name,address,city,zone,phone").order("name"),
      supabase.from("product_inventory").select("product_id,sku,name,brand,unit,purchase_price,sale_price,stock,active,image_url").eq("active", true).eq("is_project_product", false).order("name"),
      supabase.from("profiles").select("id,full_name,role,active").eq("active", true).order("full_name"),
      supabase.from("sales").select("id,sale_number,customer_id,user_id,quotation_id,sale_date,customer_address,payment_method,delivery_time,purchase_order_number,subject,status,subtotal,discount,total,amount_paid,balance,due_date,due_date_override,observations,created_at").order("created_at", {ascending:false}),
      supabase.from("quotations").select("id,quotation_number,customer_id,user_id,quotation_date,delivery_time,payment_terms,observations,customer_address,status,subtotal,discount,total").order("created_at", {ascending:false}),
      supabase.from("sale_items").select("sale_id,product_id,quantity,purchase_cost,subtotal"),
    ]);
    const firstError = c.error || p.error || u.error || s.error || q.error || si.error;
    if (firstError) setError(firstError.message);
    setCustomers(c.data ?? []); setProducts(p.data ?? []); setSellers(u.data ?? []); setSales(s.data ?? []); setQuotations(q.data ?? []); setAllSaleItems(si.data ?? []);
  }

  async function reloadSales() {
    const {data,error:e} = await supabase.from("sales").select("id,sale_number,customer_id,user_id,quotation_id,sale_date,customer_address,payment_method,delivery_time,purchase_order_number,subject,status,subtotal,discount,total,amount_paid,balance,due_date,due_date_override,observations,created_at").order("created_at", {ascending:false});
    if (e) setError(e.message); else setSales(data ?? []);
  }

  function resetSale() {
    setSaved(null); setItems([]); setCustomerId(""); setSellerId(profile?.id ?? ""); setQuotationId("");
    setPaymentMethod("Contado"); setDeliveryTime("Inmediata"); setPurchaseOrderNumber(""); setSubject(""); setDiscount("0"); setAmountPaid("0"); setDueDate(""); setDueDateOverride(false);
    setObservations(""); setProductSearch(""); setError(""); setScreen("new");
    if (params.get("quotation")) setParams({});
  }

  async function loadQuotation(id: string) {
    if (!id || saved) return;
    const q = quotations.find(x => x.id === id);
    if (!q) return;
    setLoading(true); setError("");
    try {
      const {data: existing} = await supabase.from("sales").select("id,sale_number").eq("quotation_id", id).maybeSingle();
      if (existing) throw new Error(`La cotización ya fue convertida en la venta ${existing.sale_number}.`);
      const {data:qi,error:e} = await supabase.from("quotation_items").select("product_id,sku,client_item_code,description,brand,unit,quantity,unit_price,discount,subtotal,delivery_date").eq("quotation_id", id).order("id");
      if (e) throw e;
      // Los renglones que vinieron sin producto de catálogo (cotizados como
      // "ítem sin catálogo") todavía no pueden salir de inventario: hace
      // falta vincularlos a un producto real antes de poder confirmar la
      // venta. needs_link marca esos renglones para la revisión obligatoria.
      const normalized = (qi ?? []).map((i:any) => {
        const p = products.find(x => x.product_id === i.product_id);
        return {
          ...i,
          brand: i.brand || p?.brand || "",
          unit: i.unit || p?.unit || "unidad",
          stock: Number(p?.stock || 0),
          purchase_cost: Number(p?.purchase_price || 0),
          client_item_code: i.client_item_code || "",
          delivery_date: i.delivery_date || "",
          needs_link: !i.product_id,
        };
      });
      setQuotationId(id); setCustomerId(q.customer_id); setSellerId(q.user_id || profile?.id || "");
      setPaymentMethod(q.payment_terms === "Crédito" ? "Crédito" : "Contado"); setDeliveryTime(q.delivery_time || "Inmediata");
      setPurchaseOrderNumber(""); setSubject("");
      setDiscount(String(q.discount || 0)); setObservations(q.observations || ""); setItems(normalized); setScreen("new");
    } catch(e:any) { setError(e.message || "No fue posible convertir la cotización."); setScreen("list"); }
    finally { setLoading(false); }
  }

  function addProduct(p:any) {
    setError("");
    if (Number(p.stock) <= 0) return setError("El producto no tiene stock disponible.");
    if (items.some(x => x.product_id === p.product_id)) return;
    setItems([...items, { product_id:p.product_id, sku:p.sku, description:p.name, brand:p.brand || "", unit:p.unit || "unidad", quantity:1, unit_price:Number(p.sale_price || 0), purchase_cost:Number(p.purchase_price || 0), discount:0, stock:Number(p.stock || 0), client_item_code:"", delivery_date:"" }]);
  }

  // Vincula (o corrige) el producto real de catálogo de un renglón que vino
  // de una cotización — obligatorio para los que llegaron sin producto
  // (cotizados como "ítem sin catálogo") y disponible también para corregir
  // un vínculo equivocado antes de confirmar la venta y descontar stock.
  function linkItemProduct(idx: number, productId: string) {
    const p = products.find(x => x.product_id === productId);
    if (!p) return;
    setItems(items.map((x, n) => n === idx ? {
      ...x,
      product_id: p.product_id,
      sku: p.sku,
      brand: p.brand || "",
      unit: p.unit || "unidad",
      stock: Number(p.stock || 0),
      purchase_cost: Number(p.purchase_price || 0),
      needs_link: false,
    } : x));
  }

  const filteredProducts = useMemo(() => {
    const n = productSearch.trim().toLowerCase();
    return !n ? products : products.filter(p => `${p.sku} ${p.name} ${p.brand || ""}`.toLowerCase().includes(n));
  }, [products, productSearch]);
  const filteredSales = useMemo(() => {
    const n = saleSearch.trim().toLowerCase();
    if (!n) return sales;
    return sales.filter(s => {
      const c = customers.find(x=>x.id===s.customer_id)?.name || "";
      return `${s.sale_number} ${c}`.toLowerCase().includes(n);
    });
  }, [sales, saleSearch, customers]);

  const subtotal = items.reduce((a,i)=>a + Math.max(0, Number(i.quantity)*Number(i.unit_price)-Number(i.discount||0)), 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const paid = paymentMethod === "Contado" ? total : Math.min(total, Math.max(0, Number(amountPaid || 0)));
  const balance = Math.max(0, total - paid);
  const selectedCustomer = customers.find(c=>c.id===customerId);
  const selectedSeller = sellers.find(s=>s.id===sellerId) || (profile?.id===sellerId ? profile : null);

  async function saveSale() {
    setError("");
    if (!profile || !customerId || !sellerId || !items.length) return setError("Selecciona cliente, vendedor y al menos un producto.");
    if (items.some(i => i.needs_link)) return setError("Hay ítems de la cotización sin producto de catálogo vinculado. Selecciona el producto correspondiente para cada uno antes de confirmar la venta.");
    if (paymentMethod === "Crédito" && balance > 0 && !dueDate) return setError("Para una venta a crédito con saldo pendiente debes indicar fecha de vencimiento.");
    if (paymentMethod === "Crédito" && balance > 0 && dueDate && dueDate < isoToday() && !dueDateOverride) return setError("El vencimiento no puede ser anterior a hoy. Si es un caso excepcional, marca la confirmación de vencimiento excepcional.");
    for (const i of items) {
      if (Number(i.quantity) <= 0) return setError(`La cantidad de ${i.sku} debe ser mayor a cero.`);
      if (Number(i.quantity) > Number(i.stock)) return setError(`Stock insuficiente para ${i.sku}. Disponible: ${qty(i.stock)}.`);
    }
    setLoading(true);
    let saleId:string|undefined;
    try {
      const {data:s,error:se} = await supabase.from("sales").insert({
        customer_id:customerId, user_id:sellerId, quotation_id:quotationId || null,
        customer_address:selectedCustomer?.address?.trim() || null, payment_method:paymentMethod, delivery_time:deliveryTime || null,
        purchase_order_number: purchaseOrderNumber.trim() || null, subject: subject.trim() || null,
        subtotal, discount:Number(discount||0), total, amount_paid:paid, balance, due_date:paymentMethod==="Crédito" && balance>0 ? dueDate : null,
        due_date_override: paymentMethod==="Crédito" && balance>0 ? dueDateOverride : false,
        observations:observations.trim() || null, status:"borrador",
      }).select().single();
      if (se) throw se; saleId=s.id;
      const {error:ie} = await supabase.from("sale_items").insert(items.map(i=>({
        sale_id:s.id, product_id:i.product_id, sku:i.sku, description:i.description, brand:i.brand||null, unit:i.unit||"unidad",
        quantity:Number(i.quantity), unit_price:Number(i.unit_price), purchase_cost:Number(i.purchase_cost||0), discount:Number(i.discount||0),
        subtotal:Math.max(0, Number(i.quantity)*Number(i.unit_price)-Number(i.discount||0)),
        client_item_code: i.client_item_code?.trim() || null, delivery_date: i.delivery_date || null,
      })));
      if (ie) throw ie;
      const {data:confirmed,error:ce} = await supabase.from("sales").update({status:"confirmada"}).eq("id",s.id).select().single();
      if (ce) throw ce;
      setSaved(confirmed); setScreen("view"); await loadAll();
    } catch(e:any) {
      setError((e.message || "No fue posible registrar la venta.") + (saleId ? " La venta quedó como borrador; no se descontó inventario." : ""));
    } finally { setLoading(false); }
  }

  async function viewSale(s:any, printAfter=false) {
    setLoading(true); setError("");
    try {
      const {data,error:e} = await supabase.from("sale_items").select("*").eq("sale_id",s.id).order("id"); if(e) throw e;
      setSaved(s); setCustomerId(s.customer_id); setSellerId(s.user_id); setQuotationId(s.quotation_id || ""); setPaymentMethod(s.payment_method); setDeliveryTime(s.delivery_time || "—");
      setPurchaseOrderNumber(s.purchase_order_number || ""); setSubject(s.subject || "");
      setDiscount(String(s.discount||0)); setAmountPaid(String(s.amount_paid||0)); setDueDate(s.due_date||""); setObservations(s.observations||""); setItems((data??[]).map((i:any)=>({...i,stock:0})));
      setEditingDueDate(false); setShowDeliveryForm(false);
      await loadDeliveryData(s.id);
      setScreen("view"); if(printAfter) setTimeout(()=>window.print(),120);
    } catch(e:any){ setError(e.message || "No fue posible abrir la venta."); } finally { setLoading(false); }
  }

  async function loadDeliveryData(saleId: string) {
    const [statusRes, notesRes] = await Promise.all([
      supabase.from("sale_items_delivery_status").select("*").eq("sale_id", saleId),
      supabase.from("delivery_notes").select("id,delivery_number,sale_id,delivery_date,received_by,notes,created_at").eq("sale_id", saleId).order("created_at"),
    ]);
    setDeliveryStatus(statusRes.data ?? []);
    setDeliveryNotesList(notesRes.data ?? []);
  }

  function startEditDueDate() {
    setDueDateDraft(saved?.due_date || "");
    setDueDateDraftOverride(false);
    setEditingDueDate(true);
  }

  async function saveDueDateEdit() {
    if (!saved) return;
    setSavingDueDate(true); setError("");
    try {
      const { data, error: e } = await supabase.from("sales").update({
        due_date: dueDateDraft || null,
        due_date_override: dueDateDraftOverride,
      }).eq("id", saved.id).select().single();
      if (e) throw e;
      setSaved(data); setDueDate(data.due_date || ""); setEditingDueDate(false);
      await reloadSales();
    } catch (e: any) {
      setError(e.message || "No fue posible actualizar el vencimiento. Si el mensaje menciona que el vencimiento no puede ser anterior a la emisión, marca la confirmación de caso excepcional.");
    } finally { setSavingDueDate(false); }
  }

  function openDeliveryForm() {
    setDeliveryQty({});
    setDeliveryReceivedBy("");
    setDeliveryNotesText("");
    setShowDeliveryForm(true);
  }

  async function saveDeliveryNote() {
    if (!saved) return;
    setError("");
    const linesToDeliver = deliveryStatus
      .map(st => ({ st, q: Number(deliveryQty[st.sale_item_id] || 0) }))
      .filter(x => x.q > 0);
    if (!linesToDeliver.length) { setError("Indica al menos una cantidad a entregar."); return; }
    for (const { st, q } of linesToDeliver) {
      if (q > Number(st.quantity_pending)) { setError(`La cantidad a entregar de ${st.sku} supera lo pendiente (${qty(st.quantity_pending)}).`); return; }
    }
    setSavingDelivery(true);
    try {
      const { data: note, error: ne } = await supabase.from("delivery_notes").insert({
        sale_id: saved.id,
        received_by: deliveryReceivedBy.trim() || null,
        notes: deliveryNotesText.trim() || null,
        created_by: profile?.id ?? null,
      }).select().single();
      if (ne) throw ne;
      const { error: ie } = await supabase.from("delivery_note_items").insert(
        linesToDeliver.map(({ st, q }) => ({ delivery_note_id: note.id, sale_item_id: st.sale_item_id, quantity: q }))
      );
      if (ie) throw ie;
      setShowDeliveryForm(false);
      const { data: refreshedSale } = await supabase.from("sales").select("id,sale_number,customer_id,user_id,quotation_id,sale_date,customer_address,payment_method,delivery_time,purchase_order_number,subject,status,subtotal,discount,total,amount_paid,balance,due_date,due_date_override,observations,created_at").eq("id", saved.id).single();
      if (refreshedSale) setSaved(refreshedSale);
      await loadDeliveryData(saved.id);
      await reloadSales();
    } catch (e: any) {
      setError(e.message || "No fue posible registrar la nota de entrega.");
    } finally { setSavingDelivery(false); }
  }

  async function viewDeliveryNote(note: any, printAfter = false) {
    setError("");
    const { data, error: e } = await supabase
      .from("delivery_note_items")
      .select("id,quantity,sale_item_id")
      .eq("delivery_note_id", note.id);
    if (e) { setError(e.message); return; }
    const withInfo = (data ?? []).map((di: any) => {
      const st = deliveryStatus.find(s => s.sale_item_id === di.sale_item_id) || items.find(i => i.id === di.sale_item_id);
      return { ...di, sku: st?.sku, description: st?.description, unit: st?.unit, client_item_code: st?.client_item_code };
    });
    setViewingDeliveryNote(note);
    setViewingDeliveryItems(withInfo);
    setScreen("delivery");
    if (printAfter) setTimeout(() => window.print(), 120);
  }

  async function cancelSale() {
    if (!saved || saved.status === "anulada") return;
    if (Number(saved.amount_paid || 0) > 0) { setError("La venta tiene pagos registrados. Regulariza la cobranza antes de anular."); return; }
    const reason = window.prompt("Motivo de anulación de la venta:");
    if (reason === null) return;
    setLoading(true); setError("");
    const { data, error:e } = await supabase.rpc("cancel_sale", { p_sale_id:saved.id, p_reason:reason || null });
    if (e) setError(e.message); else { setSaved(data); await loadAll(); }
    setLoading(false);
  }

  function inReportPeriod(date:string) {
    const d = date.slice(0,10), ref=reportDate.slice(0,10);
    if(reportPeriod==="dia") return d===ref;
    if(reportPeriod==="mes") return d.slice(0,7)===ref.slice(0,7);
    return d.slice(0,4)===ref.slice(0,4);
  }
  const reportSales = sales.filter(s=>s.status!=="anulada" && inReportPeriod(s.sale_date));
  const reportTotal = reportSales.reduce((a,s)=>a+Number(s.total||0),0);
  const reportCollected = reportSales.reduce((a,s)=>a+Number(s.amount_paid||0),0);
  const reportBalance = reportSales.reduce((a,s)=>a+Number(s.balance||0),0);
  const reportIds = new Set(reportSales.map(s=>s.id));
  const reportCost = allSaleItems.filter(i=>reportIds.has(i.sale_id)).reduce((a,i)=>a+Number(i.quantity||0)*Number(i.purchase_cost||0),0);
  const reportMargin = reportTotal - reportCost;
  const reportMarginPct = reportTotal > 0 ? (reportMargin/reportTotal)*100 : 0;
  const bySeller = Object.values(reportSales.reduce((acc:any,s:any)=>{
    const name=sellers.find(x=>x.id===s.user_id)?.full_name || "Usuario";
    acc[s.user_id] ||= {id:s.user_id,name,count:0,total:0}; acc[s.user_id].count++; acc[s.user_id].total+=Number(s.total||0); return acc;
  },{})) as any[];

  return <Layout title="Ventas" subtitle="Registro de ventas, salida automática de inventario y reporte comercial">
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between print:hidden">
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>{setScreen("list");setSaved(null);}} className={`px-4 py-2.5 rounded-xl text-sm border ${screen==="list"?"bg-[#1B3A6B] text-white":"bg-white"}`}><FileText size={15} className="inline mr-1"/>Ventas guardadas</button>
          <button onClick={resetSale} className={`px-4 py-2.5 rounded-xl text-sm border ${screen==="new"?"bg-[#1B3A6B] text-white":"bg-white"}`}><Plus size={15} className="inline mr-1"/>Nueva venta</button>
          <button onClick={()=>setScreen("report")} className={`px-4 py-2.5 rounded-xl text-sm border ${screen==="report"?"bg-[#1B3A6B] text-white":"bg-white"}`}><BarChart3 size={15} className="inline mr-1"/>Reporte</button>
        </div>
      </div>
      {error && <div className="p-3 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm print:hidden">{error}</div>}

      {screen==="list" && <div className="bg-white rounded-2xl p-5 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div><h2 className="font-semibold text-[#0F2647]">Ventas guardadas</h2><div className="text-xs text-[#5B6670]">Busca por código de venta o cliente.</div></div>
          <div className="relative md:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]"/><input value={saleSearch} onChange={e=>setSaleSearch(e.target.value)} placeholder="VEN-2026-... o cliente" className="w-full border rounded-xl py-2.5 pl-9 pr-3 text-sm"/></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Código</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Pago</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Saldo</th><th className="text-right">Acciones</th></tr></thead>
          <tbody>{filteredSales.map(s=><tr key={s.id} className="border-b hover:bg-[#FAFBFC]"><td className="py-3 font-mono text-xs font-semibold">{s.sale_number}</td><td>{formatDate(s.sale_date)}</td><td>{customers.find(c=>c.id===s.customer_id)?.name||"—"}</td><td>{sellers.find(x=>x.id===s.user_id)?.full_name||"—"}</td><td>{s.payment_method}</td><td><span className="px-2 py-1 rounded-full bg-slate-100 text-xs capitalize">{s.status}</span></td><td className="text-right font-semibold">Bs {money(s.total)}</td><td className="text-right">Bs {money(s.balance)}</td><td><div className="flex justify-end gap-2"><button onClick={()=>viewSale(s)} className="p-2 rounded-lg border"><Eye size={15}/></button><button onClick={()=>viewSale(s,true)} className="p-2 rounded-lg border"><Printer size={15}/></button></div></td></tr>)}
          {filteredSales.length===0 && <tr><td colSpan={9} className="py-10 text-center italic text-[#5B6670]">No se encontraron ventas.</td></tr>}</tbody></table></div>
      </div>}

      {screen==="new" && <div className="grid xl:grid-cols-2 gap-5 print:hidden">
        <div className="bg-white rounded-2xl p-5 space-y-4">
          {quotationId && <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">Venta originada desde cotización <b>{quotations.find(q=>q.id===quotationId)?.quotation_number}</b>.</div>}
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs text-[#5B6670]">Cliente<select disabled={!!quotationId} value={customerId} onChange={e=>setCustomerId(e.target.value)} className="w-full border rounded-xl p-2.5 mt-1 text-sm"><option value="">Seleccionar...</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="text-xs text-[#5B6670]">Vendedor<select value={sellerId} onChange={e=>setSellerId(e.target.value)} className="w-full border rounded-xl p-2.5 mt-1 text-sm"><option value="">Seleccionar...</option>{sellers.map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.role}</option>)}</select></label>
          </div>
          {selectedCustomer && <div className="text-xs bg-slate-50 border rounded-xl p-3"><b>Dirección:</b> {selectedCustomer.address||"Sin dirección registrada"}</div>}
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]"/><input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Buscar producto por código, descripción o marca..." className="w-full border rounded-xl py-2.5 pl-9 pr-3 text-sm"/></div>
          <div className="border rounded-xl divide-y max-h-[500px] overflow-auto">{filteredProducts.map(p=>{const selected=items.some(i=>i.product_id===p.product_id), noStock=Number(p.stock)<=0; return <div key={p.product_id} className="p-3 flex gap-3 items-center hover:bg-[#FAFBFC]"><div className="w-12 h-12 border rounded-lg flex items-center justify-center overflow-hidden">{p.image_url?<img src={p.image_url} className="w-full h-full object-contain"/>:<ShoppingCart size={17}/>}</div><div className="flex-1 min-w-0"><div className="font-medium text-sm">{p.sku}</div><div className="text-xs text-[#5B6670] line-clamp-2">{p.name}</div><div className="text-xs">{p.brand||"—"} · Bs {money(p.sale_price)} · Stock <b>{qty(p.stock)}</b></div></div><button disabled={selected||noStock} onClick={()=>addProduct(p)} className={`px-3 py-2 rounded-lg text-xs ${selected?"bg-green-50 text-green-700":noStock?"bg-gray-100 text-gray-400":"bg-[#1B3A6B] text-white"}`}>{selected?<><Check size={14} className="inline mr-1"/>Agregado</>:noStock?"Sin stock":"Agregar"}</button></div>})}</div>
        </div>
        <div className="bg-white rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Productos de la venta ({items.length})</h3>
          {items.length===0 && <div className="border border-dashed rounded-xl p-8 text-center text-sm text-[#5B6670]">Selecciona productos o convierte una cotización.</div>}
          {items.map((i,idx)=><div key={i.id || i.product_id || `unlinked-${idx}`} className={`border-b py-3 ${i.needs_link ? "bg-amber-50 -mx-5 px-5" : ""}`}>
            <div className="flex justify-between gap-3 text-sm">
              <span>{i.sku ? <b>{i.sku}</b> : <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-semibold align-middle mr-1">SIN VINCULAR</span>} · {i.description}
                <span className="block text-xs text-[#5B6670]">Marca: {i.brand||"—"}{i.product_id ? ` · Disponible: ${qty(i.stock)}` : ""}{i.client_item_code ? ` · Código cliente: ${i.client_item_code}` : ""}</span>
              </span>
              <button onClick={()=>setItems(items.filter((_,x)=>x!==idx))}><Trash2 size={16} className="text-red-600"/></button>
            </div>

            {i.needs_link && <div className="mt-2">
              <div className="flex items-center gap-1 text-xs text-amber-800 mb-1"><AlertTriangle size={13}/>Este ítem vino de la cotización sin producto de catálogo. Selecciona el producto real antes de poder confirmar la venta.</div>
              <select onChange={e => e.target.value && linkItemProduct(idx, e.target.value)} defaultValue="" className="w-full border border-amber-300 rounded-lg p-2 text-sm bg-white">
                <option value="">Vincular producto de catálogo...</option>
                {products.map(p => <option key={p.product_id} value={p.product_id}>{p.sku} · {p.name} (stock {qty(p.stock)})</option>)}
              </select>
            </div>}

            {!i.needs_link && <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <label className="text-[11px]">Cantidad<input type="number" min="0.01" max={i.stock} step="0.01" value={i.quantity} onChange={e=>setItems(items.map((x,n)=>n===idx?{...x,quantity:Number(e.target.value)}:x))} className="w-full border rounded-lg p-2 mt-1"/></label>
                <label className="text-[11px]">Precio<input type="number" min="0" step="0.01" value={i.unit_price} onChange={e=>setItems(items.map((x,n)=>n===idx?{...x,unit_price:Number(e.target.value)}:x))} className="w-full border rounded-lg p-2 mt-1"/></label>
                <div className="text-[11px]">Total<div className="p-2 mt-1 font-medium">Bs {money(Number(i.quantity)*Number(i.unit_price)-Number(i.discount||0))}</div></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <label className="text-[11px]">Código cliente (Nº ítem de su OC)<input value={i.client_item_code||""} onChange={e=>setItems(items.map((x,n)=>n===idx?{...x,client_item_code:e.target.value}:x))} placeholder="Ej. 30" className="w-full border rounded-lg p-2 mt-1"/></label>
                <label className="text-[11px]">Fecha de entrega (opcional)<input type="date" value={i.delivery_date||""} onChange={e=>setItems(items.map((x,n)=>n===idx?{...x,delivery_date:e.target.value}:x))} className="w-full border rounded-lg p-2 mt-1"/></label>
              </div>
              {i.product_id && <div className="mt-1">
                <select onChange={e => e.target.value && linkItemProduct(idx, e.target.value)} defaultValue="" className="w-full border rounded-lg p-1.5 text-[11px] text-[#5B6670] bg-white">
                  <option value="">Cambiar producto vinculado...</option>
                  {products.map(p => <option key={p.product_id} value={p.product_id}>{p.sku} · {p.name} (stock {qty(p.stock)})</option>)}
                </select>
              </div>}
            </>}
          </div>)}
          <div className="grid md:grid-cols-2 gap-3 mt-4"><label className="text-xs">Forma de pago<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full border rounded-lg p-2 mt-1"><option>Contado</option><option>Crédito</option></select></label><label className="text-xs">Tiempo de entrega<input value={deliveryTime} onChange={e=>setDeliveryTime(e.target.value)} className="w-full border rounded-lg p-2 mt-1"/></label></div>
          <div className="grid md:grid-cols-2 gap-3 mt-3"><label className="text-xs">Orden de compra (Nº, para la nota de entrega)<input value={purchaseOrderNumber} onChange={e=>setPurchaseOrderNumber(e.target.value)} className="w-full border rounded-lg p-2 mt-1"/></label><label className="text-xs">Objeto (para la nota de entrega)<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Ej. ADQUISICION DE EQUIPOS ELECTRICOS" className="w-full border rounded-lg p-2 mt-1"/></label></div>
          {paymentMethod==="Crédito" && <div className="grid md:grid-cols-2 gap-3 mt-3"><label className="text-xs">Pago inicial (Bs)<input type="number" min="0" max={total} step="0.01" value={amountPaid} onChange={e=>setAmountPaid(e.target.value)} className="w-full border rounded-lg p-2 mt-1"/></label><label className="text-xs">Vencimiento<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="w-full border rounded-lg p-2 mt-1"/></label></div>}
          <label className="block text-xs mt-3">Descuento general (Bs)<input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)} className="w-full border rounded-lg p-2 mt-1"/></label>
          <label className="block text-xs mt-3">Observaciones<textarea rows={3} value={observations} onChange={e=>setObservations(e.target.value)} className="w-full border rounded-lg p-2 mt-1"/></label>
          <div className="mt-4 border-t pt-4 text-sm space-y-1"><div className="flex justify-between"><span>Subtotal</span><span>Bs {money(subtotal)}</span></div><div className="flex justify-between"><span>Descuento</span><span>Bs {money(discount)}</span></div><div className="flex justify-between font-semibold text-base"><span>Total</span><span>Bs {money(total)}</span></div><div className="flex justify-between"><span>Pagado</span><span>Bs {money(paid)}</span></div><div className="flex justify-between font-semibold"><span>Saldo</span><span>Bs {money(balance)}</span></div></div>
          {paymentMethod==="Crédito" && balance>0 && dueDate && dueDate < isoToday() && <label className="flex items-start gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800"><input type="checkbox" checked={dueDateOverride} onChange={e=>setDueDateOverride(e.target.checked)} className="mt-0.5"/><span>El vencimiento elegido es anterior a hoy. Confirmo que es un caso excepcional y quiero guardarlo así.</span></label>}
          {items.some(i=>i.needs_link) && <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2"><AlertTriangle size={14}/>Vincula todos los ítems sin catálogo a un producto real antes de confirmar.</div>}
          <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">Al confirmar la venta se descontará automáticamente el stock de cada producto.</div>
          <button disabled={loading || items.some(i=>i.needs_link)} onClick={saveSale} className="w-full mt-4 py-2.5 rounded-xl bg-[#1B3A6B] text-white disabled:opacity-50">{loading?"Confirmando...":"Confirmar venta"}</button>
        </div>
      </div>}

      {screen==="view" && saved && <div className="bg-white rounded-2xl p-8 max-w-6xl mx-auto print:p-0">
        <div className="flex justify-between gap-4 border-b pb-4"><div><h2 className="text-xl font-bold">{COMPANY.name}</h2><div className="text-xs text-[#5B6670]">{COMPANY.address}<br/>{COMPANY.phones}<br/>{COMPANY.email} · {COMPANY.web}</div></div><div className="text-right"><div className="font-semibold">NOTA DE VENTA</div><div className="font-mono font-semibold">{saved.sale_number}</div><div>{formatDate(saved.sale_date)}</div></div></div>
        <div className="grid md:grid-cols-2 gap-2 py-5 text-sm"><div>Cliente: <b>{selectedCustomer?.name||"—"}</b></div><div>Vendedor: <b>{selectedSeller?.full_name||"—"}</b></div><div className="md:col-span-2">Dirección: <b>{saved.customer_address||selectedCustomer?.address||"—"}</b></div>{saved.quotation_id && <div className="md:col-span-2">Cotización origen: <b>{quotations.find(q=>q.id===saved.quotation_id)?.quotation_number||"—"}</b></div>}</div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">#</th><th>Código</th><th>Cód. cliente</th><th>Descripción</th><th>Marca</th><th className="text-right">Cant.</th><th>Unidad</th><th>Entrega</th><th className="text-right">P. Unit.</th><th className="text-right">Total</th></tr></thead><tbody>{items.map((i,n)=><tr key={i.id||i.product_id} className="border-b"><td className="py-2">{n+1}</td><td className="font-mono text-xs">{i.sku}</td><td>{i.client_item_code||"—"}</td><td>{i.description}</td><td>{i.brand||"—"}</td><td className="text-right">{qty(i.quantity)}</td><td>{i.unit||"unidad"}</td><td>{i.delivery_date?formatDate(i.delivery_date):"—"}</td><td className="text-right">Bs {money(i.unit_price)}</td><td className="text-right">Bs {money(i.subtotal ?? (Number(i.quantity)*Number(i.unit_price)-Number(i.discount||0)))}</td></tr>)}</tbody></table></div>
        <div className="mt-4 ml-auto max-w-xs text-sm space-y-1"><div className="flex justify-between"><span>Subtotal</span><b>Bs {money(saved.subtotal)}</b></div><div className="flex justify-between"><span>Descuento</span><b>Bs {money(saved.discount)}</b></div><div className="flex justify-between border-t pt-2 text-base"><span>Total</span><b>Bs {money(saved.total)}</b></div><div className="flex justify-between"><span>Pagado</span><b>Bs {money(saved.amount_paid)}</b></div><div className="flex justify-between"><span>Saldo</span><b>Bs {money(saved.balance)}</b></div></div>
        <div className="mt-6 text-xs space-y-1">
          <div><b>Forma de pago:</b> {saved.payment_method}</div>
          <div><b>Tiempo de entrega:</b> {saved.delivery_time||"—"}</div>
          <div className="flex items-center gap-2">
            <b>Vencimiento:</b> {saved.due_date ? formatDate(saved.due_date) : "—"}{saved.due_date_override && <span className="print:hidden px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">excepcional</span>}
            {saved.payment_method==="Crédito" && !editingDueDate && <button onClick={startEditDueDate} className="print:hidden text-[#1B3A6B] underline text-[11px]"><Pencil size={11} className="inline mr-0.5"/>Editar</button>}
          </div>
          {editingDueDate && <div className="print:hidden flex flex-wrap items-end gap-2 bg-slate-50 border rounded-xl p-3">
            <label className="text-[11px]">Nuevo vencimiento<input type="date" value={dueDateDraft} onChange={e=>setDueDateDraft(e.target.value)} className="block border rounded-lg p-2 mt-1"/></label>
            {dueDateDraft && dueDateDraft < String(saved.sale_date).slice(0,10) && <label className="flex items-center gap-1 text-[11px] text-amber-800"><input type="checkbox" checked={dueDateDraftOverride} onChange={e=>setDueDateDraftOverride(e.target.checked)}/>Es anterior a la emisión, confirmar caso excepcional</label>}
            <button disabled={savingDueDate} onClick={saveDueDateEdit} className="px-3 py-2 rounded-lg bg-[#1B3A6B] text-white text-xs">{savingDueDate?"Guardando...":"Guardar"}</button>
            <button onClick={()=>setEditingDueDate(false)} className="px-3 py-2 rounded-lg border text-xs">Cancelar</button>
          </div>}
          {saved.observations && <div><b>Observaciones:</b> {saved.observations}</div>}
        </div>

        {saved.status!=="anulada" && saved.status!=="borrador" && <div className="mt-6 print:hidden border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[#0F2647] text-sm"><Truck size={15} className="inline mr-1"/>Entregas</h3>
            {deliveryStatus.some(st=>Number(st.quantity_pending)>0) && !showDeliveryForm && <button onClick={openDeliveryForm} className="px-3 py-1.5 rounded-lg bg-[#1B3A6B] text-white text-xs">Emitir nota de entrega</button>}
          </div>

          <div className="overflow-x-auto mb-2">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[#5B6670] border-b"><th className="py-1">Código</th><th>Cód. cliente</th><th>Descripción</th><th className="text-right">Vendido</th><th className="text-right">Entregado</th><th className="text-right">Pendiente</th></tr></thead>
              <tbody>{deliveryStatus.map(st=><tr key={st.sale_item_id} className="border-b"><td className="py-1 font-mono">{st.sku}</td><td>{st.client_item_code||"—"}</td><td>{st.description}</td><td className="text-right">{qty(st.quantity_sold)}</td><td className="text-right">{qty(st.quantity_delivered)}</td><td className={`text-right ${Number(st.quantity_pending)>0?"text-amber-700 font-semibold":""}`}>{qty(st.quantity_pending)}</td></tr>)}</tbody>
            </table>
          </div>

          {showDeliveryForm && <div className="bg-slate-50 border rounded-xl p-3 space-y-2 mb-3">
            <div className="text-xs font-semibold text-[#0F2647]">Nueva nota de entrega</div>
            {deliveryStatus.filter(st=>Number(st.quantity_pending)>0).map(st=><label key={st.sale_item_id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center text-xs">
              <span className="sm:col-span-2">{st.sku} · {st.description}<span className="block text-[10px] text-[#5B6670]">Pendiente: {qty(st.quantity_pending)}</span></span>
              <input type="number" min="0" max={st.quantity_pending} step="0.01" value={deliveryQty[st.sale_item_id]||""} onChange={e=>setDeliveryQty({...deliveryQty,[st.sale_item_id]:e.target.value})} placeholder="0" className="border rounded-lg p-2"/>
            </label>)}
            <input value={deliveryReceivedBy} onChange={e=>setDeliveryReceivedBy(e.target.value)} placeholder="Recibido por (opcional)" className="w-full border rounded-lg p-2 text-xs"/>
            <textarea value={deliveryNotesText} onChange={e=>setDeliveryNotesText(e.target.value)} placeholder="Observaciones de la entrega (opcional)" rows={2} className="w-full border rounded-lg p-2 text-xs"/>
            <div className="flex gap-2">
              <button onClick={()=>setShowDeliveryForm(false)} className="flex-1 py-2 rounded-lg border text-xs">Cancelar</button>
              <button disabled={savingDelivery} onClick={saveDeliveryNote} className="flex-1 py-2 rounded-lg bg-[#1B3A6B] text-white text-xs">{savingDelivery?"Guardando...":"Registrar entrega"}</button>
            </div>
          </div>}

          {deliveryNotesList.length>0 && <div className="space-y-1">
            {deliveryNotesList.map(dn=><div key={dn.id} className="flex items-center justify-between text-xs border-b py-1.5">
              <span className="font-mono">{dn.delivery_number} · {formatDate(dn.delivery_date)}{dn.received_by?` · Recibió: ${dn.received_by}`:""}</span>
              <div className="flex gap-1">
                <button title="Ver" onClick={()=>viewDeliveryNote(dn)} className="p-1.5 rounded border"><Eye size={13}/></button>
                <button title="Imprimir" onClick={()=>viewDeliveryNote(dn,true)} className="p-1.5 rounded border"><Printer size={13}/></button>
              </div>
            </div>)}
          </div>}
        </div>}

        <div className="mt-6 print:hidden flex flex-wrap gap-2 justify-end">{saved.status!=="anulada" && Number(saved.amount_paid||0)===0 && <button disabled={loading} onClick={cancelSale} className="px-5 py-2.5 rounded-xl border border-red-200 text-red-700">Anular venta y devolver stock</button>}<button onClick={()=>setScreen("list")} className="px-5 py-2.5 rounded-xl border">Volver</button><button onClick={()=>window.print()} className="px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white"><Printer size={16} className="inline mr-2"/>Imprimir / PDF</button></div>
      </div>}

      {screen==="delivery" && viewingDeliveryNote && <div className="bg-white rounded-2xl p-8 max-w-4xl mx-auto print:p-0">
        <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-black text-sm" style={{fontFamily:"Calibri, Arial, sans-serif"}}>
          <tbody>
            <tr>
              <td colSpan={4} className="border border-black p-3 text-center align-middle">
                <div className="text-lg font-bold">{COMPANY.name}</div>
              </td>
              <td colSpan={2} className="border border-black p-3 text-center align-middle">
                <div className="font-bold">NOTA DE ENTREGA</div>
                <div className="font-bold font-mono">{viewingDeliveryNote.delivery_number}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-center">CLIENTE: <b>{selectedCustomer?.name||"—"}</b></td>
              <td className="border border-black p-2 text-center">ORDEN DE COMPRA:</td>
              <td colSpan={2} className="border border-black p-2 text-center">FECHA</td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-center">OBJETO: <b>{saved?.subject||"—"}</b></td>
              <td className="border border-black p-2 text-center">{saved?.purchase_order_number||"—"}</td>
              <td colSpan={2} className="border border-black p-2 text-center">{formatDate(viewingDeliveryNote.delivery_date)}</td>
            </tr>
            <tr className="font-bold">
              <td className="border border-black p-2 text-center">Nº</td>
              <td className="border border-black p-2 text-center">ITEM</td>
              <td className="border border-black p-2 text-center">CODIGO</td>
              <td className="border border-black p-2 text-center">DESCRIPCIÓN</td>
              <td className="border border-black p-2 text-center">CANTIDAD</td>
              <td className="border border-black p-2 text-center">UM</td>
            </tr>
            {viewingDeliveryItems.map((i,n)=><tr key={i.id}>
              <td className="border border-black p-2 text-center">{n+1}</td>
              <td className="border border-black p-2 text-center">{i.client_item_code||"—"}</td>
              <td className="border border-black p-2 text-center font-mono text-xs">{i.sku||"—"}</td>
              <td className="border border-black p-2 text-left">{i.description||"—"}</td>
              <td className="border border-black p-2 text-center">{qty(i.quantity)}</td>
              <td className="border border-black p-2 text-center">{i.unit||"unidad"}</td>
            </tr>)}
            <tr>
              <td colSpan={3} className="border border-black p-3 pt-10 text-center align-bottom">
                <div>Recibido Por:</div>
                <div className="font-semibold mt-1">{selectedCustomer?.name||""}</div>
                {viewingDeliveryNote.received_by && <div className="text-xs mt-1">{viewingDeliveryNote.received_by}</div>}
              </td>
              <td colSpan={3} className="border border-black p-3 pt-10 text-center align-bottom">
                <div>Entregado Por:</div>
                <div className="font-semibold mt-1">{COMPANY.name}</div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
        {viewingDeliveryNote.notes && <div className="mt-4 text-xs print:mt-2"><b>Observaciones:</b> {viewingDeliveryNote.notes}</div>}
        <div className="mt-6 print:hidden flex flex-wrap gap-2 justify-end">
          <button onClick={()=>setScreen("view")} className="px-5 py-2.5 rounded-xl border">Volver a la venta</button>
          <button onClick={()=>window.print()} className="px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white"><Printer size={16} className="inline mr-2"/>Imprimir / PDF</button>
        </div>
      </div>}

      {screen==="report" && <div className="space-y-4 print:hidden">
        <div className="bg-white rounded-2xl p-5"><div className="flex flex-wrap items-end gap-3"><label className="text-xs">Periodo<select value={reportPeriod} onChange={e=>setReportPeriod(e.target.value as any)} className="block border rounded-lg p-2 mt-1"><option value="dia">Día</option><option value="mes">Mes</option><option value="anio">Año</option></select></label><label className="text-xs">Fecha de referencia<input type={reportPeriod==="dia"?"date":reportPeriod==="mes"?"month":"number"} min={reportPeriod==="anio"?"2020":undefined} max={reportPeriod==="anio"?"2100":undefined} value={reportPeriod==="anio"?reportDate.slice(0,4):reportPeriod==="mes"?reportDate.slice(0,7):reportDate} onChange={e=>setReportDate(reportPeriod==="anio"?`${e.target.value}-01-01`:reportPeriod==="mes"?`${e.target.value}-01`:e.target.value)} className="block border rounded-lg p-2 mt-1"/></label></div></div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3"><div className="bg-white rounded-2xl p-4"><div className="text-xs text-[#5B6670]">Ventas</div><div className="text-2xl font-semibold">{reportSales.length}</div></div><div className="bg-white rounded-2xl p-4"><div className="text-xs text-[#5B6670]">Monto vendido</div><div className="text-2xl font-semibold">Bs {money(reportTotal)}</div></div><div className="bg-white rounded-2xl p-4"><div className="text-xs text-[#5B6670]">Cobrado</div><div className="text-2xl font-semibold">Bs {money(reportCollected)}</div></div><div className="bg-white rounded-2xl p-4"><div className="text-xs text-[#5B6670]">Saldo por cobrar</div><div className="text-2xl font-semibold">Bs {money(reportBalance)}</div></div></div><div className="grid sm:grid-cols-3 gap-3"><div className="bg-white rounded-2xl p-4"><div className="text-xs text-[#5B6670]">Costo de productos</div><div className="text-xl font-semibold">Bs {money(reportCost)}</div></div><div className="bg-white rounded-2xl p-4"><div className="text-xs text-[#5B6670]">Margen bruto</div><div className="text-xl font-semibold">Bs {money(reportMargin)}</div></div><div className="bg-white rounded-2xl p-4"><div className="text-xs text-[#5B6670]">Margen bruto %</div><div className="text-xl font-semibold">{money(reportMarginPct)}%</div></div></div>
        <div className="grid xl:grid-cols-2 gap-4"><div className="bg-white rounded-2xl p-5"><h3 className="font-semibold mb-3">Ventas del periodo</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Código</th><th>Fecha</th><th>Cliente</th><th className="text-right">Total</th></tr></thead><tbody>{reportSales.map(s=><tr key={s.id} className="border-b"><td className="py-2 font-mono text-xs">{s.sale_number}</td><td>{formatDate(s.sale_date)}</td><td>{customers.find(c=>c.id===s.customer_id)?.name||"—"}</td><td className="text-right">Bs {money(s.total)}</td></tr>)}</tbody></table></div></div><div className="bg-white rounded-2xl p-5"><h3 className="font-semibold mb-3">Resumen por vendedor</h3>{bySeller.map(r=><div key={r.id} className="flex justify-between py-2 border-b text-sm"><span>{r.name}<span className="block text-xs text-[#5B6670]">{r.count} venta(s)</span></span><b>Bs {money(r.total)}</b></div>)}{bySeller.length===0 && <div className="text-sm italic text-[#5B6670]">Sin ventas en el periodo.</div>}</div></div>
      </div>}
    </div>
  </Layout>;
}
