import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import {
  Plus, Search, Eye, Trash2, Check, X, ShoppingBag, Package,
  Truck, Receipt, Upload, BarChart3, ClipboardList, ExternalLink, Pencil,
  RefreshCw, FileText, Paperclip, Printer, PackageCheck,
} from "lucide-react";

const COMPANY = { name: "SACIPETROL S.R.L." };

const moneyFmt = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = (v: any) => moneyFmt.format(Number(v || 0));
const qty = (v: any) => qtyFmt.format(Number(v || 0));
function formatDate(value?: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat("es-BO").format(new Date(y, m - 1, d));
}
function isoToday() { return new Date().toISOString().slice(0, 10); }
function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_LABELS: Record<string, string> = {
  registrado: "Registrado", cotizado: "Cotizado", ganado: "Ganado",
  perdido: "Perdido", en_compra: "En compra", facturado: "Facturado / Cerrado",
};
const STATUS_BADGE: Record<string, string> = {
  registrado: "bg-slate-100 text-slate-700", cotizado: "bg-blue-100 text-blue-700",
  ganado: "bg-green-100 text-green-700", perdido: "bg-red-100 text-red-700",
  en_compra: "bg-amber-100 text-amber-700", facturado: "bg-[#0F2647] text-white",
};
const EXPENSE_LABELS: Record<string, string> = { transporte: "Transporte", insumos: "Insumos", comision: "Comisión", otro: "Otro" };

const emptyForm = { name: "", client_reference: "", customer_id: "", user_id: "", commission_percent: "", contact_name: "", contact_email: "", presentation_at: "", observations: "" };
const emptyItemDraft = { client_description: "", brand: "", unit: "unidad", requested_quantity: "1", estimated_unit_cost: "0", markup_percent: "20" };
const emptyPurchase = { supplier: "", purchase_date: isoToday(), has_invoice: true, invoice_number: "", invoice_amount: "", notes: "" };
const emptyPurchaseItem = { project_item_id: "", product_id: "", quantity: "1", unit_cost: "0" };
const emptyExpense = { expense_type: "transporte", description: "", amount: "", has_invoice: false, invoice_number: "" };
const emptyNewProduct = { sku: "", name: "", brand: "", unit: "unidad", purchase_price: "", sale_price: "" };
const emptyInvoice = { invoice_number: "", issue_date: isoToday(), due_date: "", amount: "", status: "pendiente" as "pendiente" | "pagada", notes: "" };

function invoiceAlertLevel(inv: any): "vencida" | "por_vencer" | "al_dia" | "sin_fecha" | "pagada" {
  if (inv.status === "pagada") return "pagada";
  if (!inv.due_date) return "sin_fecha";
  const today = new Date(isoToday());
  const due = new Date(inv.due_date.slice(0, 10));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "vencida";
  if (diffDays <= 7) return "por_vencer";
  return "al_dia";
}
const INVOICE_ALERT_BADGE: Record<string, string> = {
  vencida: "bg-red-100 text-red-700",
  por_vencer: "bg-amber-100 text-amber-700",
  al_dia: "bg-green-100 text-green-700",
  sin_fecha: "bg-slate-100 text-slate-600",
  pagada: "bg-[#0F2647]/10 text-[#0F2647]",
};
const INVOICE_ALERT_LABEL: Record<string, string> = {
  vencida: "Vencida", por_vencer: "Por vencer", al_dia: "Al día", sin_fecha: "Sin fecha", pagada: "Pagada",
};

function ProductPickerBox({ products, onSelect, placeholder }: { products: any[]; onSelect: (p: any) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = needle.length < 2 ? [] : products
    .filter((p: any) => `${p.sku} ${p.name} ${p.brand || ""}`.toLowerCase().includes(needle))
    .slice(0, 8);
  return (
    <div className="relative">
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={placeholder || "Buscar producto existente por código, nombre o marca..."}
        className="w-full border rounded-xl p-2.5 text-sm"
      />
      {matches.length > 0 && <div className="border rounded-xl mt-1 divide-y max-h-48 overflow-auto bg-white shadow-sm relative z-10">
        {matches.map((p: any) => (
          <button type="button" key={p.product_id} onClick={() => { onSelect(p); setQ(""); }} className="w-full text-left p-2 text-xs hover:bg-[#FAFBFC]">
            <b>{p.sku}</b> · {p.name}{p.brand ? ` · ${p.brand}` : ""}{p.is_project_product ? <span className="ml-1 text-amber-700">(pendiente de compra)</span> : ""}
          </button>
        ))}
      </div>}
      {needle.length >= 2 && matches.length === 0 && <div className="text-xs text-[#5B6670] mt-1">No se encontró ningún producto existente con ese texto — completa los datos abajo como ítem nuevo.</div>}
    </div>
  );
}

export function Proyectos() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin";
  const canManageCatalog = profile?.role !== "vendedor";

  const [screen, setScreen] = useState<"list" | "new" | "detail" | "reporte">("list");
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [newItems, setNewItems] = useState<any[]>([]);
  const [itemDraft, setItemDraft] = useState(emptyItemDraft);
  const [editingDraftIndex, setEditingDraftIndex] = useState<number | null>(null);

  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editProjectDraft, setEditProjectDraft] = useState(emptyForm);
  const [editProjectTarget, setEditProjectTarget] = useState<any>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [current, setCurrent] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<"items" | "cotizacion" | "compras" | "gastos" | "documentos" | "facturacion" | "rentabilidad" | "entrega">("items");
  const [items, setItems] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [profitability, setProfitability] = useState<any>(null);
  const [linkedSale, setLinkedSale] = useState<any>(null);
  const [saleDeliveryStatus, setSaleDeliveryStatus] = useState<any[]>([]);
  const [projectDeliveryNotes, setProjectDeliveryNotes] = useState<any[]>([]);
  const [viewingDeliveryNote, setViewingDeliveryNote] = useState<any>(null);
  const [viewingDeliveryItems, setViewingDeliveryItems] = useState<any[]>([]);
  const [quotationPreview, setQuotationPreview] = useState<{ quotation_number: string; subtotal: number; discount: number; total: number; items: any[] } | null>(null);

  const [itemEditDraft, setItemEditDraft] = useState(emptyItemDraft);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseDraft, setPurchaseDraft] = useState(emptyPurchase);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([{ ...emptyPurchaseItem }]);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseReceiptFile, setPurchaseReceiptFile] = useState<File | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState(emptyExpense);
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null);
  const [docTypeText, setDocTypeText] = useState("");
  const [isBackupQuote, setIsBackupQuote] = useState(false);
  const [docDescription, setDocDescription] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState(emptyInvoice);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [newProductOpen, setNewProductOpen] = useState<number | null>(null);
  const [newProductDraft, setNewProductDraft] = useState(emptyNewProduct);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [invoiceAlertsAll, setInvoiceAlertsAll] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.id) {
      setForm(f => ({ ...f, user_id: profile.id }));
      load();
    }
  }, [profile?.id]);

  async function load() {
    setError("");
    const [p, c, s, pr, ia] = await Promise.all([
      supabase.from("projects").select("id,project_number,name,client_reference,customer_id,user_id,status,commission_percent,commission_amount,quotation_id,sale_id,observations,contact_name,contact_email,presentation_at,created_at").order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,address").order("name"),
      supabase.from("profiles").select("id,full_name,role,active").eq("active", true).order("full_name"),
      supabase.from("product_inventory").select("product_id,sku,name,brand,unit,purchase_price,sale_price,stock,active,is_project_product").eq("active", true).order("name"),
      supabase.from("project_invoice_alerts").select("project_id,alert_level"),
    ]);
    const firstError = p.error || c.error || s.error || pr.error;
    if (firstError) setError(firstError.message);
    setProjects(p.data ?? []);
    setCustomers(c.data ?? []);
    setSellers(s.data ?? []);
    setProducts(pr.data ?? []);
    setInvoiceAlertsAll(ia.data ?? []);
  }

  async function reloadProjects() {
    const { data, error: e } = await supabase.from("projects").select("id,project_number,name,client_reference,customer_id,user_id,status,commission_percent,commission_amount,quotation_id,sale_id,observations,contact_name,contact_email,presentation_at,created_at").order("created_at", { ascending: false });
    if (e) setError(e.message); else setProjects(data ?? []);
  }

  const filteredProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return projects.filter(p => {
      const okStatus = statusFilter === "todos" || p.status === statusFilter;
      const text = `${p.project_number} ${p.name} ${p.client_reference || ""}`.toLowerCase();
      return okStatus && (!needle || text.includes(needle));
    });
  }, [projects, search, statusFilter]);

  const invoiceAlertCount = useMemo(
    () => invoices.filter(i => { const lvl = invoiceAlertLevel(i); return lvl === "vencida" || lvl === "por_vencer"; }).length,
    [invoices]
  );

  const canManageInvoices = isAdmin || profile?.role === "gerente" || (!!current && !!profile && current.user_id === profile.id);

  const projectInvoiceAlert = useMemo(() => {
    const map = new Map<string, "vencida" | "por_vencer">();
    for (const row of invoiceAlertsAll) {
      if (row.alert_level !== "vencida" && row.alert_level !== "por_vencer") continue;
      if (row.alert_level === "vencida" || map.get(row.project_id) !== "vencida") map.set(row.project_id, row.alert_level);
    }
    return map;
  }, [invoiceAlertsAll]);

  function resetNewProject() {
    setError("");
    setForm({ ...emptyForm, user_id: profile?.id ?? "" });
    setNewItems([]);
    setItemDraft(emptyItemDraft);
    setEditingDraftIndex(null);
    setScreen("new");
  }

  function addItemDraft() {
    setError("");
    if (!itemDraft.client_description.trim() || Number(itemDraft.requested_quantity) <= 0) {
      setError("Indica la descripción del ítem y una cantidad mayor a cero.");
      return;
    }
    const cost = Number(itemDraft.estimated_unit_cost) || 0;
    const markup = Number(itemDraft.markup_percent) || 0;
    const built = {
      ...itemDraft,
      estimated_unit_cost: cost,
      markup_percent: markup,
      requested_quantity: Number(itemDraft.requested_quantity),
      proposed_unit_price: Math.round(cost * (1 + markup / 100) * 100) / 100,
    };
    if (editingDraftIndex !== null) {
      setNewItems(newItems.map((it, idx) => idx === editingDraftIndex ? built : it));
      setEditingDraftIndex(null);
    } else {
      setNewItems([...newItems, built]);
    }
    setItemDraft(emptyItemDraft);
  }

  function editDraftItem(idx: number) {
    const it = newItems[idx];
    setItemDraft({
      client_description: it.client_description || "",
      brand: it.brand || "",
      unit: it.unit || "unidad",
      requested_quantity: String(it.requested_quantity ?? "1"),
      estimated_unit_cost: String(it.estimated_unit_cost ?? "0"),
      markup_percent: String(it.markup_percent ?? "20"),
    });
    setEditingDraftIndex(idx);
    setError("");
  }

  function cancelDraftEdit() {
    setEditingDraftIndex(null);
    setItemDraft(emptyItemDraft);
  }

  async function saveProject() {
    setError("");
    if (!profile || !form.name.trim() || !form.customer_id || !form.user_id) {
      setError("Indica nombre del proyecto, cliente y vendedor asignado.");
      return;
    }
    if (newItems.length === 0) {
      setError("Agrega al menos un ítem solicitado por el cliente.");
      return;
    }
    setSaving(true);
    try {
      const { data: p, error: pe } = await supabase.from("projects").insert({
        name: form.name.trim(),
        client_reference: form.client_reference.trim() || null,
        customer_id: form.customer_id,
        user_id: form.user_id,
        commission_percent: form.commission_percent ? Number(form.commission_percent) : null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        presentation_at: form.presentation_at ? new Date(form.presentation_at).toISOString() : null,
        observations: form.observations.trim() || null,
        created_by: profile.id,
      }).select().single();
      if (pe) throw pe;

      const { error: ie } = await supabase.from("project_items").insert(newItems.map(i => ({
        project_id: p.id,
        client_description: i.client_description.trim(),
        brand: i.brand?.trim() || null,
        unit: i.unit.trim() || "unidad",
        requested_quantity: i.requested_quantity,
        estimated_unit_cost: i.estimated_unit_cost,
        markup_percent: i.markup_percent,
        proposed_unit_price: i.proposed_unit_price,
      })));
      if (ie) throw ie;

      await reloadProjects();
      await openProject(p);
    } catch (e: any) {
      setError(e.message || "No fue posible registrar el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  async function openProject(p: any) {
    setCurrent(p);
    setDetailTab("items");
    setViewingDeliveryNote(null);
    setScreen("detail");
    await loadDetail(p);
  }

  function openEditProject(p: any) {
    setEditProjectTarget(p);
    setEditProjectDraft({
      name: p.name || "",
      client_reference: p.client_reference || "",
      customer_id: p.customer_id || "",
      user_id: p.user_id || "",
      commission_percent: p.commission_percent != null ? String(p.commission_percent) : "",
      contact_name: p.contact_name || "",
      contact_email: p.contact_email || "",
      presentation_at: toDatetimeLocal(p.presentation_at),
      observations: p.observations || "",
    });
    setError("");
    setEditProjectOpen(true);
  }

  async function saveEditProject() {
    if (!editProjectTarget) return;
    setError("");
    if (!editProjectDraft.name.trim() || !editProjectDraft.customer_id || !editProjectDraft.user_id) {
      setError("Indica nombre del proyecto, cliente y vendedor asignado.");
      return;
    }
    setSaving(true);
    const { error: e } = await supabase.from("projects").update({
      name: editProjectDraft.name.trim(),
      client_reference: editProjectDraft.client_reference.trim() || null,
      customer_id: editProjectDraft.customer_id,
      user_id: editProjectDraft.user_id,
      commission_percent: editProjectDraft.commission_percent ? Number(editProjectDraft.commission_percent) : null,
      contact_name: editProjectDraft.contact_name.trim() || null,
      contact_email: editProjectDraft.contact_email.trim() || null,
      presentation_at: editProjectDraft.presentation_at ? new Date(editProjectDraft.presentation_at).toISOString() : null,
      observations: editProjectDraft.observations.trim() || null,
    }).eq("id", editProjectTarget.id);
    setSaving(false);
    if (e) { setError(e.message); return; }
    setEditProjectOpen(false);
    await reloadProjects();
    if (current?.id === editProjectTarget.id) await refreshCurrentProject();
  }

  async function deleteProject(p: any) {
    if (!window.confirm(`¿Eliminar el proyecto ${p.project_number} — "${p.name}"? Se eliminarán también sus ítems, compras, gastos y documentos registrados. Esta acción no se puede deshacer.`)) return;
    const { error: e } = await supabase.from("projects").delete().eq("id", p.id);
    if (e) { setError(e.message); return; }
    if (current?.id === p.id) { setCurrent(null); setScreen("list"); }
    await reloadProjects();
  }

  async function loadDetail(p: any) {
    setLoading(true);
    setError("");
    try {
      const [i, pu, ex, doc, inv] = await Promise.all([
        supabase.from("project_items").select("id,project_id,product_id,client_item_code,client_description,internal_description,brand,unit,requested_quantity,estimated_unit_cost,markup_percent,proposed_unit_price,created_at").eq("project_id", p.id).order("created_at"),
        supabase.from("project_purchases").select("id,project_id,supplier,purchase_date,has_invoice,invoice_number,invoice_amount,receipt_url,notes,created_at").eq("project_id", p.id).order("created_at", { ascending: false }),
        supabase.from("project_expenses").select("id,project_id,expense_type,description,amount,has_invoice,invoice_number,receipt_url,created_at").eq("project_id", p.id).order("created_at", { ascending: false }),
        supabase.from("project_documents").select("id,project_id,document_type,is_backup_quote,file_url,description,uploaded_by,uploaded_at").eq("project_id", p.id).order("uploaded_at", { ascending: false }),
        supabase.from("project_invoices").select("id,project_id,invoice_number,issue_date,due_date,amount,status,file_url,notes,created_at").eq("project_id", p.id).order("due_date", { ascending: true, nullsFirst: false }),
      ]);
      if (i.error) throw i.error;
      if (pu.error) throw pu.error;
      if (ex.error) throw ex.error;
      if (doc.error) throw doc.error;
      if (inv.error) throw inv.error;

      setItems(i.data ?? []);
      setInvoices(inv.data ?? []);

      const purchaseRows = pu.data ?? [];
      let purchaseItemRows: any[] = [];
      if (purchaseRows.length) {
        const { data: pid, error: pie } = await supabase
          .from("project_purchase_items")
          .select("id,purchase_id,project_item_id,product_id,quantity,unit_cost")
          .in("purchase_id", purchaseRows.map((x: any) => x.id));
        if (pie) throw pie;
        purchaseItemRows = pid ?? [];
      }
      setPurchases(purchaseRows.map((row: any) => ({ ...row, items: purchaseItemRows.filter((it: any) => it.purchase_id === row.id) })));
      setExpenses(ex.data ?? []);
      setDocuments(doc.data ?? []);

      if (p.quotation_id) {
        const { data: sale } = await supabase.from("sales").select("id,sale_number,status,total,amount_paid,balance,quotation_id,sale_date,purchase_order_number,subject").eq("quotation_id", p.quotation_id).maybeSingle();
        setLinkedSale(sale ?? null);
        await loadQuotationPreview(p.quotation_id);
      } else {
        setLinkedSale(null);
        setQuotationPreview(null);
      }

      // Nota de entrega: solo tiene sentido una vez que el proyecto ya tiene
      // una venta generada (se emite desde Ventas; acá solo se muestra).
      if (p.sale_id) {
        const [statusRes, notesRes] = await Promise.all([
          supabase.from("sale_items_delivery_status").select("*").eq("sale_id", p.sale_id),
          supabase.from("delivery_notes").select("id,delivery_number,sale_id,delivery_date,received_by,notes,created_at").eq("sale_id", p.sale_id).order("created_at"),
        ]);
        setSaleDeliveryStatus(statusRes.data ?? []);
        setProjectDeliveryNotes(notesRes.data ?? []);
      } else {
        setSaleDeliveryStatus([]);
        setProjectDeliveryNotes([]);
      }

      if (isAdmin) {
        const { data: prof, error: profErr } = await supabase.from("project_profitability").select("*").eq("project_id", p.id).maybeSingle();
        if (profErr) throw profErr;
        setProfitability(prof ?? null);
      } else {
        setProfitability(null);
      }
    } catch (e: any) {
      setError(e.message || "No fue posible cargar el detalle del proyecto.");
    } finally {
      setLoading(false);
    }
  }

  async function loadQuotationPreview(quotationId: string) {
    const [{ data: q }, { data: qi }] = await Promise.all([
      supabase.from("quotations").select("quotation_number,subtotal,discount,total").eq("id", quotationId).single(),
      supabase.from("quotation_items").select("id,sku,description,brand,unit,quantity,unit_price,discount,subtotal").eq("quotation_id", quotationId).order("id"),
    ]);
    if (!q) { setQuotationPreview(null); return; }
    setQuotationPreview({
      quotation_number: q.quotation_number,
      subtotal: Number(q.subtotal || 0),
      discount: Number(q.discount || 0),
      total: Number(q.total || 0),
      items: qi ?? [],
    });
  }

  async function refreshCurrentProject() {
    if (!current) return;
    const { data, error: e } = await supabase.from("projects").select("id,project_number,name,client_reference,customer_id,user_id,status,commission_percent,commission_amount,quotation_id,sale_id,observations,contact_name,contact_email,presentation_at,created_at").eq("id", current.id).single();
    if (e) { setError(e.message); return; }
    setCurrent(data);
    await loadDetail(data);
    await reloadProjects();
  }

  async function addItemToProject() {
    if (!current) return;
    setError("");
    if (!itemEditDraft.client_description.trim() || Number(itemEditDraft.requested_quantity) <= 0) {
      setError("Indica la descripción del ítem y una cantidad mayor a cero.");
      return;
    }
    const cost = Number(itemEditDraft.estimated_unit_cost) || 0;
    const markup = Number(itemEditDraft.markup_percent) || 0;
    const payload = {
      client_description: itemEditDraft.client_description.trim(),
      brand: itemEditDraft.brand?.trim() || null,
      unit: itemEditDraft.unit.trim() || "unidad",
      requested_quantity: Number(itemEditDraft.requested_quantity),
      estimated_unit_cost: cost,
      markup_percent: markup,
      proposed_unit_price: Math.round(cost * (1 + markup / 100) * 100) / 100,
    };
    const { error: e } = editingItemId
      ? await supabase.from("project_items").update(payload).eq("id", editingItemId)
      : await supabase.from("project_items").insert({ project_id: current.id, ...payload });
    if (e) { setError(e.message); return; }
    setItemEditDraft(emptyItemDraft);
    setEditingItemId(null);
    await loadDetail(current);
  }

  function editExistingItem(item: any) {
    setItemEditDraft({
      client_description: item.client_description || "",
      brand: item.brand || "",
      unit: item.unit || "unidad",
      requested_quantity: String(item.requested_quantity ?? "1"),
      estimated_unit_cost: String(item.estimated_unit_cost ?? "0"),
      markup_percent: String(item.markup_percent ?? "20"),
    });
    setEditingItemId(item.id);
    setError("");
  }

  function cancelItemEdit() {
    setEditingItemId(null);
    setItemEditDraft(emptyItemDraft);
  }

  async function removeItem(itemId: string) {
    if (!window.confirm("¿Quitar este ítem del proyecto?")) return;
    const { error: e } = await supabase.from("project_items").delete().eq("id", itemId);
    if (e) { setError(e.message); return; }
    if (editingItemId === itemId) cancelItemEdit();
    await loadDetail(current);
  }

  // El código SACIPETROL (products.sku) ya no se crea ni se vincula desde
  // Ítems ni desde la Cotización — recién se da de alta cuando el proyecto se
  // gana y se registra la compra real (ver createProductForPurchaseRow, en
  // la pestaña Compras).

  async function createProductForPurchaseRow(idx: number) {
    if (!profile) return;
    setError("");
    if (!newProductDraft.sku.trim() || !newProductDraft.name.trim()) {
      setError("Indica código SACIPETROL y nombre del producto nuevo.");
      return;
    }
    const skuNeedle = newProductDraft.sku.trim().toLowerCase();
    const existing = products.find((p: any) => (p.sku || "").trim().toLowerCase() === skuNeedle);
    if (existing) {
      setError(`Ya existe un producto con el código "${newProductDraft.sku.trim()}" (${existing.name}). Usa el selector de producto en lugar de crear uno nuevo, o cambia el código SACIPETROL si en verdad es un producto distinto.`);
      return;
    }
    try {
      const { data: newProduct, error: pe } = await supabase.from("products").insert({
        sku: newProductDraft.sku.trim(),
        name: newProductDraft.name.trim(),
        brand: newProductDraft.brand.trim() || null,
        unit: newProductDraft.unit.trim() || "unidad",
        purchase_price: Number(newProductDraft.purchase_price) || 0,
        sale_price: Number(newProductDraft.sale_price) || 0,
        active: true,
        // Se crea directamente como producto real: nace de una compra real
        // que se está registrando ahora mismo (is_project_product queda en
        // su valor por defecto, false).
      }).select("id").single();
      if (pe) throw pe;
      updatePurchaseItemRow(idx, { product_id: newProduct.id });
      await load();
      setNewProductOpen(null);
      setNewProductDraft(emptyNewProduct);
    } catch (e: any) {
      if (e?.code === "23505" || /products_sku_unique/i.test(e?.message || "")) {
        setError(`Ya existe un producto con el código "${newProductDraft.sku.trim()}". Usa el selector de producto en lugar de crear uno nuevo, o cambia el código SACIPETROL si en verdad es un producto distinto.`);
      } else {
        setError(e.message || "No fue posible crear el producto.");
      }
    }
  }

  async function generateQuotation() {
    if (!current) return;
    setError("");
    if (items.length === 0) { setError("El proyecto no tiene ítems."); return; }
    setSaving(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() + 15);
      const subtotal = items.reduce((s, i) => s + Number(i.requested_quantity) * Number(i.proposed_unit_price), 0);

      const { data: q, error: qe } = await supabase.from("quotations").insert({
        customer_id: current.customer_id,
        user_id: current.user_id,
        valid_until: d.toISOString().slice(0, 10),
        delivery_time: "A coordinar según disponibilidad",
        payment_terms: "Contado",
        observations: `Proyecto ${current.project_number}${current.client_reference ? " — Ref. cliente: " + current.client_reference : ""}`,
        subtotal, discount: 0, total: subtotal,
        status: "emitida",
      }).select().single();
      if (qe) throw qe;

      // Los ítems todavía no tienen por qué estar vinculados a un producto
      // del catálogo — se cotizan tal como los pidió el cliente. El vínculo
      // (y la creación del código SACIPETROL) se hace recién en Compras,
      // cuando se gana el proyecto y se compra de verdad.
      const { error: ie } = await supabase.from("quotation_items").insert(items.map(i => ({
        quotation_id: q.id,
        product_id: null,
        sku: null,
        description: i.internal_description || i.client_description,
        brand: i.brand || null,
        unit: i.unit || "unidad",
        quantity: Number(i.requested_quantity),
        unit_price: Number(i.proposed_unit_price),
        discount: 0,
        subtotal: Number(i.requested_quantity) * Number(i.proposed_unit_price),
      })));
      if (ie) throw ie;

      const { error: ue } = await supabase.from("projects").update({ quotation_id: q.id, status: "cotizado" }).eq("id", current.id);
      if (ue) throw ue;

      await refreshCurrentProject();
    } catch (e: any) {
      setError(e.message || "No fue posible generar la cotización.");
    } finally {
      setSaving(false);
    }
  }

  async function markStatus(status: string) {
    if (!current) return;
    if (status === "perdido") {
      const reason = window.prompt("Motivo de pérdida del proyecto (opcional):");
      if (reason === null) return;
      const obs = current.observations ? `${current.observations}\nPERDIDO: ${reason || "Sin motivo registrado"}` : `PERDIDO: ${reason || "Sin motivo registrado"}`;
      const { error: e } = await supabase.from("projects").update({ status, observations: obs }).eq("id", current.id);
      if (e) { setError(e.message); return; }
    } else {
      const { error: e } = await supabase.from("projects").update({ status }).eq("id", current.id);
      if (e) { setError(e.message); return; }
    }
    await refreshCurrentProject();
  }

  async function linkSaleToProject() {
    if (!current || !linkedSale) return;
    const { error: e } = await supabase.from("projects").update({ sale_id: linkedSale.id, status: "en_compra" }).eq("id", current.id);
    if (e) { setError(e.message); return; }
    await refreshCurrentProject();
  }

  async function viewProjectDeliveryNote(note: any, printAfter = false) {
    setError("");
    const { data, error: e } = await supabase
      .from("delivery_note_items")
      .select("id,quantity,sale_item_id")
      .eq("delivery_note_id", note.id);
    if (e) { setError(e.message); return; }
    const withInfo = (data ?? []).map((di: any) => {
      const st = saleDeliveryStatus.find(s => s.sale_item_id === di.sale_item_id);
      return { ...di, sku: st?.sku, description: st?.description, unit: st?.unit, client_item_code: st?.client_item_code };
    });
    setViewingDeliveryNote(note);
    setViewingDeliveryItems(withInfo);
    if (printAfter) setTimeout(() => window.print(), 120);
  }

  async function refreshProfitability() {
    if (!current) return;
    setLoading(true);
    setError("");
    try {
      // Si ya existe una venta generada desde la cotización de este proyecto
      // pero todavía no quedó vinculada (por ejemplo, se convirtió a venta
      // desde Ventas y no se apretó "Vincular al proyecto"), se vincula sola
      // aquí — sin tocar el estado del proyecto — para que Rentabilidad jale
      // el total de ventas real.
      if (current.quotation_id && !current.sale_id) {
        const { data: sale } = await supabase.from("sales").select("id").eq("quotation_id", current.quotation_id).maybeSingle();
        if (sale) {
          await supabase.from("projects").update({ sale_id: sale.id }).eq("id", current.id);
        }
      }
      await refreshCurrentProject();
    } finally {
      setLoading(false);
    }
  }

  function addPurchaseItemRow() { setPurchaseItems([...purchaseItems, { ...emptyPurchaseItem }]); }
  function removePurchaseItemRow(idx: number) { setPurchaseItems(purchaseItems.filter((_, i) => i !== idx)); }
  function updatePurchaseItemRow(idx: number, patch: any) {
    setPurchaseItems(purchaseItems.map((row, i) => {
      if (i !== idx) return row;
      const next = { ...row, ...patch };
      if (patch.project_item_id) {
        const linked = items.find(it => it.id === patch.project_item_id);
        if (linked?.product_id) next.product_id = linked.product_id;
        if (linked?.estimated_unit_cost != null) next.unit_cost = String(linked.estimated_unit_cost);
      }
      return next;
    }));
  }

  function openPurchaseModal() {
    setPurchaseDraft(emptyPurchase);
    setPurchaseItems([{ ...emptyPurchaseItem }]);
    setEditingPurchaseId(null);
    setPurchaseReceiptFile(null);
    setError("");
    setPurchaseOpen(true);
  }

  function openEditPurchase(p: any) {
    setPurchaseDraft({
      supplier: p.supplier || "",
      purchase_date: (p.purchase_date || isoToday()).slice(0, 10),
      has_invoice: !!p.has_invoice,
      invoice_number: p.invoice_number || "",
      invoice_amount: String(p.invoice_amount ?? ""),
      notes: p.notes || "",
    });
    setPurchaseItems((p.items || []).length
      ? p.items.map((it: any) => ({
          project_item_id: it.project_item_id || "",
          product_id: it.product_id || "",
          quantity: String(it.quantity ?? "1"),
          unit_cost: String(it.unit_cost ?? "0"),
        }))
      : [{ ...emptyPurchaseItem }]);
    setEditingPurchaseId(p.id);
    setPurchaseReceiptFile(null);
    setError("");
    setPurchaseOpen(true);
  }

  async function deletePurchase(p: any) {
    if (!window.confirm(`¿Eliminar la compra a ${p.supplier} del ${formatDate(p.purchase_date)}? Esto revierte el ingreso a inventario que generó (y, si el producto no tiene otra compra registrada, vuelve a quedar pendiente de compra). Esta acción no se puede deshacer.`)) return;
    setError("");
    const { error } = await supabase.from("project_purchases").delete().eq("id", p.id);
    if (error) { setError(error.message); return; }
    await refreshCurrentProject();
    await load();
  }

  async function savePurchase() {
    if (!current || !profile) return;
    setError("");
    if (!purchaseDraft.supplier.trim()) { setError("Indica el proveedor de la compra."); return; }
    const validRows = purchaseItems.filter(r => r.product_id && Number(r.quantity) > 0);
    if (validRows.length === 0) { setError("Agrega al menos un producto con cantidad mayor a cero."); return; }
    const computedInvoiceAmount = validRows.reduce((s, r) => s + Number(r.quantity) * (Number(r.unit_cost) || 0), 0);
    setSaving(true);
    try {
      let receiptUrl: string | null = editingPurchaseId ? (purchases.find(p => p.id === editingPurchaseId)?.receipt_url ?? null) : null;
      if (purchaseReceiptFile) {
        const safeName = purchaseReceiptFile.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
        const path = `compras/${current.id}/${Date.now()}-${safeName}`;
        const { error: ue2 } = await supabase.storage.from("project-documents").upload(path, purchaseReceiptFile, { contentType: purchaseReceiptFile.type || "application/octet-stream" });
        if (ue2) throw ue2;
        receiptUrl = path;
      }

      const header = {
        supplier: purchaseDraft.supplier.trim(),
        purchase_date: purchaseDraft.purchase_date || isoToday(),
        has_invoice: purchaseDraft.has_invoice,
        invoice_number: purchaseDraft.has_invoice ? (purchaseDraft.invoice_number.trim() || null) : null,
        invoice_amount: purchaseDraft.has_invoice ? computedInvoiceAmount : null,
        notes: purchaseDraft.notes.trim() || null,
        receipt_url: receiptUrl,
      };

      let purchaseId = editingPurchaseId;
      if (editingPurchaseId) {
        const { error: ue } = await supabase.from("project_purchases").update(header).eq("id", editingPurchaseId);
        if (ue) throw ue;
        // Se borran los ítems anteriores (revierte sus movimientos de
        // inventario en cascada) y se insertan los nuevos, igual que al
        // actualizar una cotización — así los triggers de stock y de
        // "pendiente de compra" quedan siempre consistentes.
        const { error: de } = await supabase.from("project_purchase_items").delete().eq("purchase_id", editingPurchaseId);
        if (de) throw de;
      } else {
        const { data: purchase, error: pe } = await supabase.from("project_purchases").insert({
          project_id: current.id,
          ...header,
          created_by: profile.id,
        }).select("id").single();
        if (pe) throw pe;
        purchaseId = purchase.id;
      }

      const { error: ie } = await supabase.from("project_purchase_items").insert(validRows.map(r => ({
        purchase_id: purchaseId,
        project_item_id: r.project_item_id || null,
        product_id: r.product_id,
        quantity: Math.round(Number(r.quantity)),
        unit_cost: Number(r.unit_cost) || 0,
      })));
      if (ie) throw ie;

      // Si la compra viene de un ítem del proyecto, deja registrado en ese
      // ítem qué producto real (código SACIPETROL) terminó siendo — solo
      // informativo, no vuelve a exigirse en ningún otro paso.
      for (const r of validRows) {
        if (r.project_item_id) {
          await supabase.from("project_items").update({ product_id: r.product_id }).eq("id", r.project_item_id);
        }
      }

      if (!editingPurchaseId && current.status === "ganado") {
        await supabase.from("projects").update({ status: "en_compra" }).eq("id", current.id);
      }

      setPurchaseOpen(false);
      setEditingPurchaseId(null);
      setPurchaseReceiptFile(null);
      await refreshCurrentProject();
      await load();
    } catch (e: any) {
      setError(e.message || "No fue posible registrar la compra.");
    } finally {
      setSaving(false);
    }
  }

  function openExpenseModal() { setExpenseDraft(emptyExpense); setExpenseReceiptFile(null); setError(""); setExpenseOpen(true); }

  async function saveExpense() {
    if (!current || !profile) return;
    setError("");
    if (!expenseDraft.description.trim() || Number(expenseDraft.amount) <= 0) {
      setError("Indica una descripción y un monto mayor a cero.");
      return;
    }
    setSaving(true);
    let receiptUrl: string | null = null;
    if (expenseReceiptFile) {
      const safeName = expenseReceiptFile.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
      const path = `gastos/${current.id}/${Date.now()}-${safeName}`;
      const { error: ue } = await supabase.storage.from("project-documents").upload(path, expenseReceiptFile, { contentType: expenseReceiptFile.type || "application/octet-stream" });
      if (ue) { setError(ue.message); setSaving(false); return; }
      receiptUrl = path;
    }
    const { error: e } = await supabase.from("project_expenses").insert({
      project_id: current.id,
      expense_type: expenseDraft.expense_type,
      description: expenseDraft.description.trim(),
      amount: Number(expenseDraft.amount),
      has_invoice: expenseDraft.has_invoice,
      invoice_number: expenseDraft.has_invoice ? (expenseDraft.invoice_number.trim() || null) : null,
      receipt_url: receiptUrl,
      created_by: profile.id,
    });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setExpenseOpen(false);
    await refreshCurrentProject();
  }

  async function uploadDocument() {
    if (!current || !profile || !docFile) { setError("Selecciona un archivo para adjuntar."); return; }
    if (!docTypeText.trim()) { setError("Indica el tipo de documento (el nombre con el que lo quieres identificar)."); return; }
    setError("");
    setSaving(true);
    // El vendedor (no admin/gerente) solo puede subir su propia cotización
    // externa de respaldo — se marca siempre, aunque no vea la casilla.
    const effectiveBackup = canManageCatalog ? isBackupQuote : true;
    try {
      const safeName = docFile.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
      const path = `${effectiveBackup ? "cotizacion_externa" : "documentos"}/${current.id}/${Date.now()}-${safeName}`;
      const { error: ue } = await supabase.storage.from("project-documents").upload(path, docFile, { contentType: docFile.type || "application/octet-stream" });
      if (ue) throw ue;
      const { error: ie } = await supabase.from("project_documents").insert({
        project_id: current.id,
        document_type: docTypeText.trim(),
        is_backup_quote: effectiveBackup,
        file_url: path,
        description: docDescription.trim() || null,
        uploaded_by: profile.id,
      });
      if (ie) throw ie;
      setDocFile(null);
      setDocTypeText("");
      setIsBackupQuote(false);
      setDocDescription("");
      await loadDetail(current);
    } catch (e: any) {
      setError(e.message || "No fue posible adjuntar el documento.");
    } finally {
      setSaving(false);
    }
  }

  async function viewDocument(doc: any) {
    const { data, error: e } = await supabase.storage.from("project-documents").createSignedUrl(doc.file_url, 300);
    if (e) { setError(e.message); return; }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function viewPurchaseReceipt(p: any) {
    if (!p.receipt_url) return;
    const { data, error: e } = await supabase.storage.from("project-documents").createSignedUrl(p.receipt_url, 300);
    if (e) { setError(e.message); return; }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function viewExpenseReceipt(ex: any) {
    if (!ex.receipt_url) return;
    const { data, error: e } = await supabase.storage.from("project-documents").createSignedUrl(ex.receipt_url, 300);
    if (e) { setError(e.message); return; }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  function openInvoiceModal() {
    setInvoiceDraft(emptyInvoice);
    setInvoiceFile(null);
    setEditingInvoiceId(null);
    setError("");
    setInvoiceOpen(true);
  }

  function openEditInvoice(inv: any) {
    setInvoiceDraft({
      invoice_number: inv.invoice_number || "",
      issue_date: (inv.issue_date || isoToday()).slice(0, 10),
      due_date: (inv.due_date || "").slice(0, 10),
      amount: String(inv.amount ?? ""),
      status: inv.status || "pendiente",
      notes: inv.notes || "",
    });
    setInvoiceFile(null);
    setEditingInvoiceId(inv.id);
    setError("");
    setInvoiceOpen(true);
  }

  function closeInvoiceModal() {
    setInvoiceOpen(false);
    setEditingInvoiceId(null);
    setInvoiceDraft(emptyInvoice);
    setInvoiceFile(null);
  }

  async function saveInvoice() {
    if (!current || !profile) return;
    setError("");
    if (!invoiceDraft.amount || Number(invoiceDraft.amount) <= 0) {
      setError("Indica el monto de la factura.");
      return;
    }
    setSaving(true);
    try {
      let file_url: string | null = editingInvoiceId ? (invoices.find(i => i.id === editingInvoiceId)?.file_url ?? null) : null;
      if (invoiceFile) {
        const safeName = invoiceFile.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
        const path = `factura_venta/${current.id}/${Date.now()}-${safeName}`;
        const { error: ue } = await supabase.storage.from("project-documents").upload(path, invoiceFile, { contentType: invoiceFile.type || "application/octet-stream" });
        if (ue) throw ue;
        file_url = path;
      }
      const payload = {
        invoice_number: invoiceDraft.invoice_number.trim() || null,
        issue_date: invoiceDraft.issue_date,
        due_date: invoiceDraft.due_date || null,
        amount: Number(invoiceDraft.amount),
        status: invoiceDraft.status,
        notes: invoiceDraft.notes.trim() || null,
        file_url,
      };
      if (editingInvoiceId) {
        const { error: ue2 } = await supabase.from("project_invoices").update(payload).eq("id", editingInvoiceId);
        if (ue2) throw ue2;
      } else {
        const { error: ie } = await supabase.from("project_invoices").insert({ ...payload, project_id: current.id, created_by: profile.id });
        if (ie) throw ie;
      }
      closeInvoiceModal();
      await loadDetail(current);
      await refreshInvoiceAlerts();
    } catch (e: any) {
      setError(e.message || "No fue posible guardar la factura.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshInvoiceAlerts() {
    const { data } = await supabase.from("project_invoice_alerts").select("project_id,alert_level");
    setInvoiceAlertsAll(data ?? []);
  }

  async function markInvoicePaid(inv: any) {
    setError("");
    const { error: e } = await supabase.from("project_invoices").update({ status: "pagada" }).eq("id", inv.id);
    if (e) { setError(e.message); return; }
    await loadDetail(current);
    await refreshInvoiceAlerts();
  }

  async function deleteInvoice(inv: any) {
    if (!window.confirm(`¿Eliminar la factura ${inv.invoice_number || "(sin número)"}? Esta acción no se puede deshacer.`)) return;
    setError("");
    const { error: e } = await supabase.from("project_invoices").delete().eq("id", inv.id);
    if (e) { setError(e.message); return; }
    await loadDetail(current);
    await refreshInvoiceAlerts();
  }

  async function viewInvoiceFile(inv: any) {
    if (!inv.file_url) return;
    const { data, error: e } = await supabase.storage.from("project-documents").createSignedUrl(inv.file_url, 300);
    if (e) { setError(e.message); return; }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function loadReport() {
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase.from("project_profitability").select("*").order("project_number", { ascending: false });
    if (e) setError(e.message); else setReportRows(data ?? []);
    setLoading(false);
  }


  const newItemsSubtotal = newItems.reduce((s, i) => s + Number(i.requested_quantity) * Number(i.proposed_unit_price), 0);
  const itemsSubtotal = items.reduce((s, i) => s + Number(i.requested_quantity) * Number(i.proposed_unit_price), 0);

  const reportTotals = useMemo(() => reportRows.reduce((acc, r) => ({
    total_ventas: acc.total_ventas + Number(r.total_ventas || 0),
    total_gastos: acc.total_gastos + Number(r.total_gastos || 0),
    impuestos_a_pagar: acc.impuestos_a_pagar + Number(r.impuestos_a_pagar || 0),
    utilidad_neta: acc.utilidad_neta + Number(r.utilidad_neta || 0),
  }), { total_ventas: 0, total_gastos: 0, impuestos_a_pagar: 0, utilidad_neta: 0 }), [reportRows]);

  return <Layout title="Proyectos" subtitle="Registro, cotización, compra y rentabilidad de proyectos puntuales (licitaciones, pedidos especiales)">
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setScreen("list"); setCurrent(null); }} className={`px-4 py-2.5 rounded-xl text-sm border ${screen === "list" ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#0F2647]"}`}><ClipboardList size={15} className="inline mr-1" />Proyectos</button>
          <button onClick={resetNewProject} className={`px-4 py-2.5 rounded-xl text-sm border ${screen === "new" ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#0F2647]"}`}><Plus size={15} className="inline mr-1" />Nuevo proyecto</button>
          {isAdmin && <button onClick={() => { setScreen("reporte"); loadReport(); }} className={`px-4 py-2.5 rounded-xl text-sm border ${screen === "reporte" ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#0F2647]"}`}><BarChart3 size={15} className="inline mr-1" />Rentabilidad consolidada</button>}
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}

      {screen === "list" && <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5">
          <div className="flex flex-col lg:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código, nombre o referencia del cliente..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-white text-sm" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-xl px-3 py-2.5 bg-white text-sm lg:w-56">
              <option value="todos">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">N°</th><th>Proyecto</th><th>Cliente</th><th>Vendedor</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead>
              <tbody>
                {filteredProjects.map(p => {
                  const c = customers.find(x => x.id === p.customer_id);
                  const s = sellers.find(x => x.id === p.user_id);
                  return <tr key={p.id} className="border-b hover:bg-[#FAFBFC]">
                    <td className="py-3 font-mono text-xs font-semibold">{p.project_number}</td>
                    <td><div className="font-medium text-[#0F2647] flex items-center gap-1.5">{p.name}{projectInvoiceAlert.has(p.id) && <span title={projectInvoiceAlert.get(p.id) === "vencida" ? "Tiene factura vencida" : "Tiene factura por vencer"} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${projectInvoiceAlert.get(p.id) === "vencida" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{projectInvoiceAlert.get(p.id) === "vencida" ? "Factura vencida" : "Factura por vencer"}</span>}</div>{p.client_reference && <div className="text-xs text-[#5B6670]">Ref: {p.client_reference}</div>}</td>
                    <td>{c?.name || "—"}</td>
                    <td>{s?.full_name || "—"}</td>
                    <td><span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[p.status]}`}>{STATUS_LABELS[p.status]}</span></td>
                    <td className="text-right"><div className="flex justify-end gap-2">
                      <button title="Ver proyecto" onClick={() => openProject(p)} className="p-2 rounded-lg border text-[#1B3A6B]"><Eye size={15} /></button>
                      <button title="Editar proyecto" onClick={() => openEditProject(p)} className="p-2 rounded-lg border text-[#1B3A6B]"><Pencil size={15} /></button>
                      {isAdmin && <button title="Eliminar proyecto" onClick={() => deleteProject(p)} className="p-2 rounded-lg border text-red-600"><Trash2 size={15} /></button>}
                    </div></td>
                  </tr>;
                })}
                {filteredProjects.length === 0 && <tr><td colSpan={6} className="py-10 text-center italic text-[#5B6670]">No se encontraron proyectos.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>}

      {screen === "new" && <div className="grid xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-[#0F2647]">Datos del proyecto</h3>
          <label className="block text-xs text-[#5B6670]">Nombre del proyecto<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej.: Suministro de transformadores YPFB" className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
          <label className="block text-xs text-[#5B6670]">Referencia del cliente / licitación<input value={form.client_reference} onChange={e => setForm({ ...form, client_reference: e.target.value })} placeholder="Ej.: YPFB-LIC-2026-014" className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block text-xs text-[#5B6670]">Cliente<select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm"><option value="">Seleccionar...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="block text-xs text-[#5B6670]">Vendedor asignado<select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm"><option value="">Seleccionar...</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.full_name} · {s.role}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Nombre de contacto (cotización)" value={form.contact_name} onChange={v => setForm({ ...form, contact_name: v })} />
            <Field label="Correo del contacto o cliente" value={form.contact_email} onChange={v => setForm({ ...form, contact_email: v })} />
          </div>
          <label className="block text-xs text-[#5B6670]">Fecha y hora de presentación<input type="datetime-local" value={form.presentation_at} onChange={e => setForm({ ...form, presentation_at: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
          <label className="block text-xs text-[#5B6670]">Comisión variable (%)<input type="number" min="0" step="0.01" value={form.commission_percent} onChange={e => setForm({ ...form, commission_percent: e.target.value })} placeholder="Ej.: 3" className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
          <label className="block text-xs text-[#5B6670]">Observaciones<textarea rows={3} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
        </div>

        <div className="bg-white rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-[#0F2647]">Ítems solicitados por el cliente</h3>
          <p className="text-xs text-[#5B6670]">Si todavía no tienes el costo del proveedor, agrega el ítem igual (con costo 0) — puedes editarlo aquí antes de guardar, o más adelante desde el detalle del proyecto, antes de generar la cotización.</p>
          <div className="border rounded-xl p-3 space-y-2 bg-[#FAFBFC]">
            <label className="block text-xs text-[#5B6670]">Unidad<input value={itemDraft.unit} onChange={e => setItemDraft({ ...itemDraft, unit: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
            <label className="block text-xs text-[#5B6670]">Descripción del ítem (tal como lo pide el cliente)<textarea rows={2} value={itemDraft.client_description} onChange={e => setItemDraft({ ...itemDraft, client_description: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
            <label className="block text-xs text-[#5B6670]">Marca<input value={itemDraft.brand} onChange={e => setItemDraft({ ...itemDraft, brand: e.target.value })} placeholder="Opcional" className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="Cantidad" type="number" value={itemDraft.requested_quantity} onChange={v => setItemDraft({ ...itemDraft, requested_quantity: v })} />
              <Field label="Costo estimado (cotiz. externa)" type="number" value={itemDraft.estimated_unit_cost} onChange={v => setItemDraft({ ...itemDraft, estimated_unit_cost: v })} />
              <Field label="Markup (%)" type="number" value={itemDraft.markup_percent} onChange={v => setItemDraft({ ...itemDraft, markup_percent: v })} />
            </div>
            <div className="text-xs text-[#5B6670]">Precio propuesto al cliente: <b className="text-[#0F2647]">Bs {money((Number(itemDraft.estimated_unit_cost) || 0) * (1 + (Number(itemDraft.markup_percent) || 0) / 100))}</b></div>
            <div className="flex gap-2">
              <button onClick={addItemDraft} className="flex-1 py-2 rounded-xl bg-[#1B3A6B] text-white text-sm">{editingDraftIndex !== null ? <><Check size={14} className="inline mr-1" />Actualizar ítem</> : <><Plus size={14} className="inline mr-1" />Agregar ítem</>}</button>
              {editingDraftIndex !== null && <button onClick={cancelDraftEdit} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button>}
            </div>
          </div>

          <div className="max-h-64 overflow-auto divide-y">
            {newItems.map((i, idx) => <div key={idx} className="py-2 flex justify-between gap-2 text-sm">
              <div>{i.client_description}{i.brand && <span className="text-xs text-[#5B6670]"> · Marca: {i.brand}</span>}<div className="text-xs text-[#5B6670]">{qty(i.requested_quantity)} {i.unit} · Costo Bs {money(i.estimated_unit_cost)} · +{i.markup_percent}% → Bs {money(i.proposed_unit_price)}</div></div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => editDraftItem(idx)}><Pencil size={15} className="text-[#1B3A6B]" /></button>
                <button onClick={() => { setNewItems(newItems.filter((_, x) => x !== idx)); if (editingDraftIndex === idx) cancelDraftEdit(); }}><Trash2 size={15} className="text-red-600" /></button>
              </div>
            </div>)}
            {newItems.length === 0 && <div className="text-sm italic text-[#5B6670] py-4 text-center">Aún no agregaste ítems.</div>}
          </div>

          <div className="border-t pt-3 text-sm flex justify-between font-semibold"><span>Total estimado al cliente</span><span>Bs {money(newItemsSubtotal)}</span></div>
          <button disabled={saving} onClick={saveProject} className="w-full py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Guardando..." : "Registrar proyecto"}</button>
        </div>
      </div>}

      {screen === "detail" && current && <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-[#0F2647] text-lg">{current.name}</h2>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[current.status]}`}>{STATUS_LABELS[current.status]}</span>
              </div>
              <div className="text-xs text-[#5B6670] mt-1">{current.project_number} · Cliente: {customers.find(c => c.id === current.customer_id)?.name || "—"} · Vendedor: {sellers.find(s => s.id === current.user_id)?.full_name || "—"}</div>
              {current.client_reference && <div className="text-xs text-[#5B6670]">Ref. cliente: {current.client_reference}</div>}
              {(current.contact_name || current.contact_email || current.presentation_at) && <div className="text-xs text-[#5B6670]">{current.contact_name && <>Contacto: {current.contact_name}</>}{current.contact_name && current.contact_email && " · "}{current.contact_email && <>{current.contact_email}</>}{(current.contact_name || current.contact_email) && current.presentation_at && " · "}{current.presentation_at && <>Presentación: {formatDateTime(current.presentation_at)}</>}</div>}
            </div>
            <div className="flex flex-wrap gap-2 items-start">
              <button onClick={() => openEditProject(current)} className="px-3 py-2 rounded-xl border text-[#1B3A6B] text-sm"><Pencil size={14} className="inline mr-1" />Editar proyecto</button>
              {(current.status === "registrado" || current.status === "cotizado") && <button onClick={() => markStatus("ganado")} disabled={!current.quotation_id} title={!current.quotation_id ? "Genera la cotización antes de marcar como ganado" : ""} className="px-3 py-2 rounded-xl border text-green-700 border-green-200 disabled:opacity-40 text-sm"><Check size={14} className="inline mr-1" />Marcar ganado</button>}
              {(current.status === "registrado" || current.status === "cotizado") && <button onClick={() => markStatus("perdido")} className="px-3 py-2 rounded-xl border text-red-700 border-red-200 text-sm"><X size={14} className="inline mr-1" />Marcar perdido</button>}
              {(current.status === "en_compra") && <button onClick={() => markStatus("facturado")} className="px-3 py-2 rounded-xl border text-[#1B3A6B] text-sm">Cerrar proyecto (facturado)</button>}
              {isAdmin && <button onClick={() => deleteProject(current)} className="px-3 py-2 rounded-xl border text-red-600 border-red-200 text-sm"><Trash2 size={14} className="inline mr-1" />Eliminar</button>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["items", "Ítems", Package],
            ["cotizacion", "Cotización / Venta", ShoppingBag],
            ["compras", "Compras", Truck],
            ["gastos", "Gastos", Receipt],
            ["documentos", "Documentos", Upload],
            ["facturacion", "Facturación", FileText],
            ...(isAdmin ? [["rentabilidad", "Rentabilidad", BarChart3]] as any : []),
            ["entrega", "Nota de entrega", PackageCheck],
          ].map(([key, label, Icon]: any) => (
            <button key={key} onClick={() => { setDetailTab(key); setViewingDeliveryNote(null); }} className={`relative px-3.5 py-2 rounded-xl text-sm border ${detailTab === key ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#0F2647]"}`}>
              <Icon size={14} className="inline mr-1" />{label}
              {key === "facturacion" && invoiceAlertCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold align-middle">{invoiceAlertCount}</span>}
            </button>
          ))}
        </div>

        {loading && <div className="text-sm text-[#5B6670]">Cargando...</div>}

        {detailTab === "items" && !loading && <div className="bg-white rounded-2xl p-5 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Descripción</th><th>Marca</th><th className="text-right">Cant.</th><th className="text-right">Costo est.</th><th className="text-right">Markup</th><th className="text-right">Precio propuesto</th><th></th></tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} className="border-b align-top">
                    <td className="py-2 min-w-48">{i.client_description}</td>
                    <td>{i.brand || "—"}</td>
                    <td className="text-right">{qty(i.requested_quantity)} {i.unit}</td>
                    <td className="text-right">Bs {money(i.estimated_unit_cost)}</td>
                    <td className="text-right">{i.markup_percent ?? 0}%</td>
                    <td className="text-right font-medium">Bs {money(i.proposed_unit_price)}</td>
                    <td><div className="flex gap-2">
                      <button onClick={() => editExistingItem(i)}><Pencil size={15} className="text-[#1B3A6B]" /></button>
                      <button onClick={() => removeItem(i.id)}><Trash2 size={15} className="text-red-600" /></button>
                    </div></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={7} className="py-8 text-center italic text-[#5B6670]">Sin ítems registrados.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="text-sm text-right font-semibold">Total estimado al cliente: Bs {money(itemsSubtotal)}</div>

          <div className="border rounded-xl p-3 bg-[#FAFBFC] space-y-2">
            <div className="text-sm font-semibold text-[#0F2647]">{editingItemId ? "Editar ítem" : "Agregar ítem"}</div>
            <p className="text-xs text-[#5B6670]">Puedes actualizar el costo estimado y el markup en cualquier momento, por ejemplo cuando ya tengas la cotización real del proveedor — el precio propuesto se recalcula automáticamente. No hace falta vincular ni crear ningún producto del catálogo todavía — eso se hace recién cuando ganes el proyecto y registres la compra real, en la pestaña Compras.</p>
            <label className="block text-xs text-[#5B6670]">Unidad<input value={itemEditDraft.unit} onChange={e => setItemEditDraft({ ...itemEditDraft, unit: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
            <label className="block text-xs text-[#5B6670]">Descripción<textarea rows={2} value={itemEditDraft.client_description} onChange={e => setItemEditDraft({ ...itemEditDraft, client_description: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
            <label className="block text-xs text-[#5B6670]">Marca<input value={itemEditDraft.brand} onChange={e => setItemEditDraft({ ...itemEditDraft, brand: e.target.value })} placeholder="Opcional" className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="Cantidad" type="number" value={itemEditDraft.requested_quantity} onChange={v => setItemEditDraft({ ...itemEditDraft, requested_quantity: v })} />
              <Field label="Costo estimado" type="number" value={itemEditDraft.estimated_unit_cost} onChange={v => setItemEditDraft({ ...itemEditDraft, estimated_unit_cost: v })} />
              <Field label="Markup (%)" type="number" value={itemEditDraft.markup_percent} onChange={v => setItemEditDraft({ ...itemEditDraft, markup_percent: v })} />
            </div>
            <div className="flex gap-2">
              <button onClick={addItemToProject} className="px-4 py-2 rounded-xl bg-[#1B3A6B] text-white text-sm">{editingItemId ? <><Check size={14} className="inline mr-1" />Guardar cambios</> : <><Plus size={14} className="inline mr-1" />Agregar</>}</button>
              {editingItemId && <button onClick={cancelItemEdit} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button>}
            </div>
          </div>
        </div>}

        {detailTab === "cotizacion" && !loading && <div className="bg-white rounded-2xl p-5 space-y-4">
          {!current.quotation_id && <div className="space-y-3">
            <p className="text-sm text-[#5B6670]">Genera la cotización SACIPETROL a partir de los ítems y precios propuestos. Todavía es una proforma — no hace falta vincular ni crear productos del catálogo para generarla.</p>
            <button disabled={saving} onClick={generateQuotation} className="px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Generando..." : "Generar cotización SACIPETROL"}</button>
          </div>}
          {current.quotation_id && <div className="space-y-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800 flex flex-wrap items-center justify-between gap-2">
              <span>Cotización {quotationPreview?.quotation_number ? <b>{quotationPreview.quotation_number}</b> : ""} generada para este proyecto.</span>
              <button onClick={() => navigate("/cotizaciones")} className="text-[#1B3A6B] font-semibold"><ExternalLink size={14} className="inline mr-1" />Ver / imprimir en Cotizaciones</button>
            </div>

            {quotationPreview && <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Código</th><th>Descripción</th><th>Marca</th><th className="text-right">Cant.</th><th>Unidad</th><th className="text-right">Precio unit.</th><th className="text-right">Subtotal</th></tr></thead>
                <tbody>
                  {quotationPreview.items.map(it => <tr key={it.id} className="border-b">
                    <td className="py-2 font-mono text-xs">{it.sku || "sin vincular"}</td>
                    <td>{it.description}</td>
                    <td>{it.brand || "—"}</td>
                    <td className="text-right">{qty(it.quantity)}</td>
                    <td>{it.unit}</td>
                    <td className="text-right whitespace-nowrap">Bs {money(it.unit_price)}</td>
                    <td className="text-right whitespace-nowrap font-medium">Bs {money(it.subtotal)}</td>
                  </tr>)}
                  {quotationPreview.items.length === 0 && <tr><td colSpan={7} className="py-6 text-center italic text-[#5B6670]">La cotización no tiene ítems.</td></tr>}
                </tbody>
              </table>
              <div className="mt-3 ml-auto max-w-xs text-sm space-y-1">
                <div className="flex justify-between"><span>Subtotal:</span><b>Bs {money(quotationPreview.subtotal)}</b></div>
                <div className="flex justify-between"><span>Descuento:</span><b>Bs {money(quotationPreview.discount)}</b></div>
                <div className="flex justify-between text-base border-t pt-2"><span>Total General:</span><b>Bs {money(quotationPreview.total)}</b></div>
              </div>
              {quotationPreview.items.some(it => Number(it.unit_price) <= 0) && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2 mt-2">Uno o más ítems salieron con precio Bs 0.00 — probablemente se generó la cotización antes de cargar el costo/markup real. Corrige el costo del ítem en la pestaña "Ítems" y luego usa "Actualizar cotización" desde Cotizaciones (botón de arriba) para que los montos se recalculen.</div>}
            </div>}

            {!current.sale_id && !linkedSale && <button onClick={() => navigate(`/ventas?quotation=${current.quotation_id}`)} className="px-5 py-2.5 rounded-xl border text-[#1B3A6B] text-sm"><ShoppingBag size={15} className="inline mr-1" />Convertir a venta</button>}
            {!current.sale_id && linkedSale && <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-sm text-green-800 flex flex-wrap items-center justify-between gap-2">
              <span>Se detectó la venta <b>{linkedSale.sale_number}</b> generada desde esta cotización.</span>
              <button onClick={linkSaleToProject} className="text-[#1B3A6B] font-semibold">Vincular al proyecto</button>
            </div>}
            {current.sale_id && <div className="rounded-xl bg-[#F5F6F8] border p-3 text-sm flex flex-wrap items-center justify-between gap-2">
              <span>Venta vinculada: <b>{linkedSale?.sale_number || "—"}</b>{linkedSale && <> · Total Bs {money(linkedSale.total)} · Saldo Bs {money(linkedSale.balance)}</>}</span>
              <button onClick={() => navigate("/cobranza")} className="text-[#1B3A6B] font-semibold"><ExternalLink size={14} className="inline mr-1" />Ir a Cobranza</button>
            </div>}
          </div>}
        </div>}

        {detailTab === "compras" && !loading && <div className="bg-white rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="text-sm text-[#5B6670]">Cada compra registrada da de alta el producto en inventario (movimiento de entrada), igual que una compra normal de mercadería. Pueden registrarse compras parciales de distintos proveedores y en distintos momentos.</div>
            <button onClick={openPurchaseModal} className="px-4 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm whitespace-nowrap"><Plus size={15} className="inline mr-1" />Registrar compra</button>
          </div>
          <div className="space-y-3">
            {purchases.map(p => <div key={p.id} className="border rounded-xl p-3">
              <div className="flex justify-between text-sm gap-2">
                <div><b>{p.supplier}</b> · {formatDate(p.purchase_date)} {p.has_invoice ? <span className="text-green-700">· Con factura {p.invoice_number ? `(${p.invoice_number})` : ""}</span> : <span className="text-amber-700">· Sin factura</span>}</div>
                <div className="flex items-center gap-3 shrink-0">
                  {p.invoice_amount != null && <div className="font-semibold">Bs {money(p.invoice_amount)}</div>}
                  {p.receipt_url && <button title="Ver recibo/factura" onClick={() => viewPurchaseReceipt(p)} className="text-[#1B3A6B]"><Paperclip size={15} /></button>}
                  {isAdmin && <button title="Editar compra" onClick={() => openEditPurchase(p)} className="text-[#1B3A6B]"><Pencil size={15} /></button>}
                  {isAdmin && <button title="Eliminar compra" onClick={() => deletePurchase(p)} className="text-red-600"><Trash2 size={15} /></button>}
                </div>
              </div>
              {p.notes && <div className="text-xs text-[#5B6670] mt-1">{p.notes}</div>}
              <div className="mt-2 text-xs divide-y">
                {(p.items || []).map((it: any) => {
                  const prod = products.find(x => x.product_id === it.product_id);
                  return <div key={it.id} className="flex justify-between py-1"><span>{prod?.sku || "—"} · {prod?.name || "Producto"}</span><span>{qty(it.quantity)} × Bs {money(it.unit_cost)} = Bs {money(Number(it.quantity) * Number(it.unit_cost))}</span></div>;
                })}
              </div>
            </div>)}
            {purchases.length === 0 && <div className="text-sm italic text-[#5B6670] text-center py-6">Sin compras registradas.</div>}
          </div>

          {purchaseOpen && <Modal title={editingPurchaseId ? "Editar compra" : "Registrar compra"} onClose={() => { setPurchaseOpen(false); setEditingPurchaseId(null); }}>
            <div className="space-y-3">
              <Field label="Proveedor" value={purchaseDraft.supplier} onChange={v => setPurchaseDraft({ ...purchaseDraft, supplier: v })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block text-xs text-[#5B6670]">Fecha<input type="date" value={purchaseDraft.purchase_date} onChange={e => setPurchaseDraft({ ...purchaseDraft, purchase_date: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
                <label className="flex items-center gap-2 text-sm sm:mt-5"><input type="checkbox" checked={purchaseDraft.has_invoice} onChange={e => setPurchaseDraft({ ...purchaseDraft, has_invoice: e.target.checked })} /> Con factura</label>
              </div>
              {purchaseDraft.has_invoice && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="N° de factura" value={purchaseDraft.invoice_number} onChange={v => setPurchaseDraft({ ...purchaseDraft, invoice_number: v })} />
                <div className="block text-xs text-[#5B6670]">Monto factura<div className="w-full border rounded-xl p-2.5 mt-1 text-sm bg-[#FAFBFC] text-[#0F2647] font-medium">Bs {money(purchaseItems.filter(r => r.product_id && Number(r.quantity) > 0).reduce((s, r) => s + Number(r.quantity) * (Number(r.unit_cost) || 0), 0))}</div><div className="text-[10px] text-[#5B6670] mt-0.5">Se calcula automáticamente: suma de cantidad × costo unitario de los productos comprados.</div></div>
              </div>}
              <Field label="Notas" value={purchaseDraft.notes} onChange={v => setPurchaseDraft({ ...purchaseDraft, notes: v })} />
              <label className="block text-xs text-[#5B6670]">Adjuntar recibo o factura de la compra (opcional)<input type="file" onChange={e => setPurchaseReceiptFile(e.target.files?.[0] || null)} className="w-full border rounded-xl p-2 mt-1 text-sm" /></label>

              <div className="border-t pt-3">
                <div className="text-sm font-semibold text-[#0F2647] mb-2">Productos comprados</div>
                <p className="text-xs text-[#5B6670] mb-2">Aquí es donde se da de alta el producto con su código SACIPETROL, si todavía no existe en el catálogo. Las cantidades son enteras (sin decimales).</p>
                {purchaseItems.map((row, idx) => <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_70px_90px_auto] gap-2 mb-1 items-end">
                  <label className="text-[11px] text-[#5B6670]">Ítem del proyecto (opcional)<select value={row.project_item_id} onChange={e => updatePurchaseItemRow(idx, { project_item_id: e.target.value })} className="w-full border rounded-lg p-2 text-xs mt-1"><option value="">—</option>{items.map(i => <option key={i.id} value={i.id}>{i.client_description.slice(0, 24)}</option>)}</select></label>
                  <label className="text-[11px] text-[#5B6670]">Producto<select value={row.product_id} onChange={e => updatePurchaseItemRow(idx, { product_id: e.target.value })} className="w-full border rounded-lg p-2 text-xs mt-1"><option value="">Seleccionar...</option>{products.map(p => <option key={p.product_id} value={p.product_id}>{p.sku} · {p.name}</option>)}</select></label>
                  <label className="text-[11px] text-[#5B6670]">Cant.<input type="number" min="1" step="1" value={row.quantity} onChange={e => updatePurchaseItemRow(idx, { quantity: Math.max(1, Math.round(Number(e.target.value) || 0)) })} className="w-full border rounded-lg p-2 text-xs mt-1" /></label>
                  <label className="text-[11px] text-[#5B6670]">Costo unit.<input type="number" min="0" step="0.01" value={row.unit_cost} onChange={e => updatePurchaseItemRow(idx, { unit_cost: e.target.value })} className="w-full border rounded-lg p-2 text-xs mt-1" /></label>
                  <button onClick={() => removePurchaseItemRow(idx)}><Trash2 size={15} className="text-red-600" /></button>
                  {!row.product_id && canManageCatalog && <button onClick={() => {
                    setNewProductOpen(idx);
                    const linkedItem = items.find(i => i.id === row.project_item_id);
                    setNewProductDraft({ sku: "", name: linkedItem ? linkedItem.client_description.slice(0, 80) : "", brand: "", unit: linkedItem?.unit || "unidad", purchase_price: row.unit_cost || "", sale_price: "" });
                  }} className="sm:col-span-4 text-left text-xs text-[#1B3A6B]">+ Crear producto nuevo (código SACIPETROL)</button>}
                </div>)}
                <button onClick={addPurchaseItemRow} className="text-xs text-[#1B3A6B] mt-2"><Plus size={13} className="inline mr-1" />Agregar producto</button>
              </div>

              <button disabled={saving} onClick={savePurchase} className="w-full py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Guardando..." : editingPurchaseId ? "Guardar cambios" : "Registrar compra"}</button>
            </div>
          </Modal>}

          {newProductOpen !== null && <Modal title="Crear producto (código SACIPETROL)" onClose={() => setNewProductOpen(null)}>
            <div className="space-y-3">
              <Field label="Código SACIPETROL" value={newProductDraft.sku} onChange={v => setNewProductDraft({ ...newProductDraft, sku: v })} />
              <Field label="Nombre / Descripción" value={newProductDraft.name} onChange={v => setNewProductDraft({ ...newProductDraft, name: v })} />
              <Field label="Marca" value={newProductDraft.brand} onChange={v => setNewProductDraft({ ...newProductDraft, brand: v })} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="Unidad" value={newProductDraft.unit} onChange={v => setNewProductDraft({ ...newProductDraft, unit: v })} />
                <Field label="Precio compra" type="number" value={newProductDraft.purchase_price} onChange={v => setNewProductDraft({ ...newProductDraft, purchase_price: v })} />
                <Field label="Precio venta" type="number" value={newProductDraft.sale_price} onChange={v => setNewProductDraft({ ...newProductDraft, sale_price: v })} />
              </div>
              <button onClick={() => createProductForPurchaseRow(newProductOpen)} className="w-full py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm">Crear y usar en esta compra</button>
            </div>
          </Modal>}
        </div>}

        {detailTab === "gastos" && !loading && <div className="bg-white rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="text-sm text-[#5B6670]">Insumos, transporte hasta la entrega y comisiones variables asociadas al proyecto.</div>
            <button onClick={openExpenseModal} className="px-4 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm whitespace-nowrap"><Plus size={15} className="inline mr-1" />Registrar gasto</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Tipo</th><th>Descripción</th><th>Factura</th><th className="text-right">Monto</th><th></th></tr></thead>
              <tbody>
                {expenses.map(ex => <tr key={ex.id} className="border-b"><td className="py-2">{EXPENSE_LABELS[ex.expense_type]}</td><td>{ex.description}</td><td>{ex.has_invoice ? (ex.invoice_number || "Con factura") : "Sin factura"}</td><td className="text-right">Bs {money(ex.amount)}</td><td>{ex.receipt_url && <button title="Ver recibo" onClick={() => viewExpenseReceipt(ex)} className="text-[#1B3A6B]"><Paperclip size={15} /></button>}</td></tr>)}
                {expenses.length === 0 && <tr><td colSpan={5} className="py-8 text-center italic text-[#5B6670]">Sin gastos registrados.</td></tr>}
              </tbody>
            </table>
          </div>

          {expenseOpen && <Modal title="Registrar gasto" onClose={() => setExpenseOpen(false)}>
            <div className="space-y-3">
              <label className="block text-xs text-[#5B6670]">Tipo<select value={expenseDraft.expense_type} onChange={e => setExpenseDraft({ ...expenseDraft, expense_type: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm">{Object.entries(EXPENSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <Field label="Descripción" value={expenseDraft.description} onChange={v => setExpenseDraft({ ...expenseDraft, description: v })} />
              <Field label="Monto" type="number" value={expenseDraft.amount} onChange={v => setExpenseDraft({ ...expenseDraft, amount: v })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={expenseDraft.has_invoice} onChange={e => setExpenseDraft({ ...expenseDraft, has_invoice: e.target.checked })} /> Con factura</label>
              {expenseDraft.has_invoice && <Field label="N° de factura" value={expenseDraft.invoice_number} onChange={v => setExpenseDraft({ ...expenseDraft, invoice_number: v })} />}
              <label className="block text-xs text-[#5B6670]">Adjuntar recibo (opcional)<input type="file" onChange={e => setExpenseReceiptFile(e.target.files?.[0] || null)} className="w-full border rounded-xl p-2 mt-1 text-sm" /></label>
              <button disabled={saving} onClick={saveExpense} className="w-full py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Guardando..." : "Registrar gasto"}</button>
            </div>
          </Modal>}
        </div>}

        {detailTab === "documentos" && !loading && <div className="bg-white rounded-2xl p-5 space-y-4">
          <div className="border rounded-xl p-3 bg-[#FAFBFC] space-y-2">
            <div className="text-sm font-semibold text-[#0F2647]">Adjuntar documento</div>
            <Field label="Tipo de documento (a tu criterio, ej.: Guía de remisión, Orden de compra firmada...)" value={docTypeText} onChange={setDocTypeText} />
            {canManageCatalog
              ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isBackupQuote} onChange={e => setIsBackupQuote(e.target.checked)} /> Es la cotización externa de respaldo del vendedor</label>
              : <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">Como vendedor solo puedes subir aquí tu cotización externa de respaldo. El tipo que escribas arriba es solo para identificarla — el resto de documentos (facturas, etc.) los sube admin/gerente.</div>}
            <label className="block text-xs text-[#5B6670]">Archivo<input type="file" onChange={e => setDocFile(e.target.files?.[0] || null)} className="w-full border rounded-xl p-2 mt-1 text-sm" /></label>
            <Field label="Descripción (opcional)" value={docDescription} onChange={setDocDescription} />
            <button disabled={saving} onClick={uploadDocument} className="w-full py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50"><Upload size={14} className="inline mr-1" />{saving ? "Subiendo..." : "Subir documento"}</button>
          </div>
          <div className="divide-y">
            {documents.map(d => <div key={d.id} className="py-2.5 flex justify-between items-center text-sm">
              <div><b>{d.document_type}</b>{d.is_backup_quote && <span className="ml-1 text-[10px] text-[#1B3A6B] bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">respaldo del vendedor</span>}{d.description && <span className="text-[#5B6670]"> · {d.description}</span>}<div className="text-xs text-[#5B6670]">{new Date(d.uploaded_at).toLocaleString("es-BO")}</div></div>
              <button onClick={() => viewDocument(d)} className="text-[#1B3A6B] font-semibold text-xs"><Eye size={14} className="inline mr-1" />Ver</button>
            </div>)}
            {documents.length === 0 && <div className="text-sm italic text-[#5B6670] text-center py-6">Sin documentos adjuntos.</div>}
          </div>
        </div>}

        {detailTab === "facturacion" && !loading && <div className="bg-white rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="text-sm font-semibold text-[#0F2647]">Facturas emitidas al cliente</div>
            {canManageInvoices && <button onClick={openInvoiceModal} className="px-3 py-2 rounded-xl bg-[#1B3A6B] text-white text-sm"><Plus size={14} className="inline mr-1" />Registrar factura</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">N° factura</th><th>Emisión</th><th>Vence</th><th className="text-right">Monto</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {invoices.map(inv => {
                  const lvl = invoiceAlertLevel(inv);
                  return <tr key={inv.id} className="border-b align-top">
                    <td className="py-2 font-mono text-xs">{inv.invoice_number || "—"}</td>
                    <td className="text-xs">{formatDate(inv.issue_date)}</td>
                    <td className="text-xs">{formatDate(inv.due_date)}</td>
                    <td className="text-right font-medium">Bs {money(inv.amount)}</td>
                    <td>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${INVOICE_ALERT_BADGE[lvl]}`}>{INVOICE_ALERT_LABEL[lvl]}</span>
                      {inv.notes && <div className="text-[11px] text-[#5B6670] mt-1">{inv.notes}</div>}
                    </td>
                    <td><div className="flex gap-2 items-center">
                      {inv.file_url && <button onClick={() => viewInvoiceFile(inv)} title="Ver adjunto"><Paperclip size={15} className="text-[#1B3A6B]" /></button>}
                      {canManageInvoices && inv.status === "pendiente" && <button onClick={() => markInvoicePaid(inv)} title="Marcar como pagada"><Check size={15} className="text-green-700" /></button>}
                      {canManageInvoices && <button onClick={() => openEditInvoice(inv)} title="Editar"><Pencil size={15} className="text-[#1B3A6B]" /></button>}
                      {isAdmin && <button onClick={() => deleteInvoice(inv)} title="Eliminar"><Trash2 size={15} className="text-red-600" /></button>}
                    </div></td>
                  </tr>;
                })}
                {invoices.length === 0 && <tr><td colSpan={6} className="py-8 text-center italic text-[#5B6670]">Sin facturas registradas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}

        {invoiceOpen && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="text-sm font-semibold text-[#0F2647]">{editingInvoiceId ? "Editar factura" : "Registrar factura"}</div>
            <Field label="N° de factura (opcional)" value={invoiceDraft.invoice_number} onChange={v => setInvoiceDraft({ ...invoiceDraft, invoice_number: v })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block text-xs text-[#5B6670]">Fecha de emisión<input type="date" value={invoiceDraft.issue_date} onChange={e => setInvoiceDraft({ ...invoiceDraft, issue_date: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
              <label className="block text-xs text-[#5B6670]">Fecha de pago esperada<input type="date" value={invoiceDraft.due_date} onChange={e => setInvoiceDraft({ ...invoiceDraft, due_date: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
            </div>
            <Field label="Monto (Bs)" value={invoiceDraft.amount} onChange={v => setInvoiceDraft({ ...invoiceDraft, amount: v })} type="number" />
            <label className="block text-xs text-[#5B6670]">Estado<select value={invoiceDraft.status} onChange={e => setInvoiceDraft({ ...invoiceDraft, status: e.target.value as any })} className="w-full border rounded-xl p-2.5 mt-1 text-sm"><option value="pendiente">Pendiente</option><option value="pagada">Pagada</option></select></label>
            <Field label="Notas (opcional)" value={invoiceDraft.notes} onChange={v => setInvoiceDraft({ ...invoiceDraft, notes: v })} />
            <label className="block text-xs text-[#5B6670]">Adjuntar factura (PDF o imagen, opcional)<input type="file" onChange={e => setInvoiceFile(e.target.files?.[0] || null)} className="w-full border rounded-xl p-2 mt-1 text-sm" /></label>
            {editingInvoiceId && invoices.find(i => i.id === editingInvoiceId)?.file_url && !invoiceFile && <div className="text-[11px] text-[#5B6670]">Ya tiene un archivo adjunto. Sube uno nuevo solo si quieres reemplazarlo.</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={closeInvoiceModal} className="flex-1 py-2.5 rounded-xl border text-sm">Cancelar</button>
              <button disabled={saving} onClick={saveInvoice} className="flex-1 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Guardando..." : editingInvoiceId ? "Guardar cambios" : "Registrar factura"}</button>
            </div>
          </div>
        </div>}

        {detailTab === "rentabilidad" && isAdmin && !loading && <div className="bg-white rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-[#0F2647]">Rentabilidad</h3>
            <button
              onClick={refreshProfitability}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#1B3A6B] border border-[#1B3A6B]/30 rounded-lg px-3 py-1.5 hover:bg-[#1B3A6B]/5 disabled:opacity-50"
              title="Recalcular con los últimos datos de ventas, compras y gastos"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
            </button>
          </div>
          {profitability ? <div className="space-y-4">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard label="Ventas" value={profitability.total_ventas} />
              <StatCard label="Compras con factura" value={profitability.compras_con_factura} />
              <StatCard label="Compras sin factura" value={profitability.compras_sin_factura} />
              <StatCard label="Gastos" value={profitability.total_gastos} />
              <StatCard label="Crédito fiscal IVA (13%)" value={profitability.credito_fiscal} />
              <StatCard label="Débito fiscal IVA (13%)" value={profitability.debito_fiscal} />
              <StatCard label="IT (3%)" value={profitability.it} />
              <StatCard label="Comisión" value={profitability.commission_amount} />
              <StatCard label="Impuestos a pagar" value={profitability.impuestos_a_pagar} />
              <StatCard label="Utilidad bruta" value={profitability.utilidad_bruta} />
              <StatCard label="Utilidad neta después de impuestos" value={profitability.utilidad_neta} strong />
            </div>
          </div> : <div className="text-sm italic text-[#5B6670] text-center py-8">Aún no hay datos suficientes de ventas/compras para calcular la rentabilidad de este proyecto.</div>}
        </div>}

        {detailTab === "entrega" && !loading && <div className="space-y-4">
          {!current.sale_id ? (
            <div className="bg-white rounded-2xl p-8 text-center text-sm text-[#5B6670]">
              La nota de entrega se genera automáticamente a partir de la nota de venta. Este proyecto todavía no tiene una venta generada.
            </div>
          ) : <div className="bg-white rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[#0F2647] text-sm">Notas de entrega de la venta {linkedSale?.sale_number || "—"}</h3>
                <div className="text-xs text-[#5B6670]">Se emiten desde Ventas; acá puedes verlas e imprimirlas, sin precios.</div>
              </div>
              <button onClick={() => navigate(`/ventas?ver=${current.sale_id}`)} className="px-3 py-2 rounded-xl bg-[#1B3A6B] text-white text-sm"><ShoppingBag size={14} className="inline mr-1" />Ir a la venta</button>
            </div>
            {projectDeliveryNotes.length === 0 && <div className="text-sm italic text-[#5B6670] py-4">Todavía no se emitió ninguna nota de entrega para esta venta.</div>}
            {projectDeliveryNotes.map(dn => <div key={dn.id} className="flex items-center justify-between text-sm border-b py-2">
              <span className="font-mono">{dn.delivery_number} · {formatDate(dn.delivery_date)}{dn.received_by ? ` · Recibió: ${dn.received_by}` : ""}</span>
              <div className="flex gap-1">
                <button title="Ver" onClick={() => viewProjectDeliveryNote(dn)} className="p-1.5 rounded border"><Eye size={14} /></button>
                <button title="Imprimir" onClick={() => viewProjectDeliveryNote(dn, true)} className="p-1.5 rounded border"><Printer size={14} /></button>
              </div>
            </div>)}
          </div>}

          {viewingDeliveryNote && <div className="bg-white rounded-2xl p-8 max-w-4xl mx-auto print:p-0">
            <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-black text-sm" style={{ fontFamily: "Calibri, Arial, sans-serif" }}>
              <tbody>
                <tr>
                  <td colSpan={4} className="border border-black p-3 text-center align-middle"><div className="text-lg font-bold">{COMPANY.name}</div></td>
                  <td colSpan={2} className="border border-black p-3 text-center align-middle"><div className="font-bold">NOTA DE ENTREGA</div><div className="font-bold font-mono">{viewingDeliveryNote.delivery_number}</div></td>
                </tr>
                <tr>
                  <td colSpan={3} className="border border-black p-2 text-center">CLIENTE: <b>{customers.find(c => c.id === current.customer_id)?.name || "—"}</b></td>
                  <td className="border border-black p-2 text-center">ORDEN DE COMPRA:</td>
                  <td colSpan={2} className="border border-black p-2 text-center">FECHA</td>
                </tr>
                <tr>
                  <td colSpan={3} className="border border-black p-2 text-center">OBJETO: <b>{linkedSale?.subject || "—"}</b></td>
                  <td className="border border-black p-2 text-center">{linkedSale?.purchase_order_number || "—"}</td>
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
                {viewingDeliveryItems.map((i, n) => <tr key={i.id}>
                  <td className="border border-black p-2 text-center">{n + 1}</td>
                  <td className="border border-black p-2 text-center">{i.client_item_code || "—"}</td>
                  <td className="border border-black p-2 text-center font-mono text-xs">{i.sku || "—"}</td>
                  <td className="border border-black p-2 text-left">{i.description || "—"}</td>
                  <td className="border border-black p-2 text-center">{qty(i.quantity)}</td>
                  <td className="border border-black p-2 text-center">{i.unit || "unidad"}</td>
                </tr>)}
                <tr>
                  <td colSpan={3} className="border border-black p-3 pt-10 text-center align-bottom">
                    <div>Recibido Por:</div>
                    <div className="font-semibold mt-1">{customers.find(c => c.id === current.customer_id)?.name || ""}</div>
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
              <button onClick={() => setViewingDeliveryNote(null)} className="px-5 py-2.5 rounded-xl border">Cerrar</button>
              <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white"><Printer size={16} className="inline mr-2" />Imprimir / PDF</button>
            </div>
          </div>}
        </div>}
      </div>}

      {screen === "reporte" && isAdmin && <div className="bg-white rounded-2xl p-5 space-y-4">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Ventas totales" value={reportTotals.total_ventas} />
          <StatCard label="Gastos totales" value={reportTotals.total_gastos} />
          <StatCard label="Impuestos a pagar" value={reportTotals.impuestos_a_pagar} />
          <StatCard label="Utilidad neta total" value={reportTotals.utilidad_neta} strong />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Proyecto</th><th>Cliente</th><th>Estado</th><th className="text-right">Ventas</th><th className="text-right">Gastos</th><th className="text-right">Impuestos</th><th className="text-right">Utilidad neta</th></tr></thead>
            <tbody>
              {reportRows.map(r => <tr key={r.project_id} className="border-b"><td className="py-2 font-mono text-xs">{r.project_number}</td><td>{r.customer_name || "—"}</td><td><span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[r.status]}`}>{STATUS_LABELS[r.status]}</span></td><td className="text-right">Bs {money(r.total_ventas)}</td><td className="text-right">Bs {money(r.total_gastos)}</td><td className="text-right">Bs {money(r.impuestos_a_pagar)}</td><td className={`text-right font-semibold ${Number(r.utilidad_neta) < 0 ? "text-red-600" : "text-[#3E7A56]"}`}>Bs {money(r.utilidad_neta)}</td></tr>)}
              {reportRows.length === 0 && <tr><td colSpan={7} className="py-10 text-center italic text-[#5B6670]">Sin proyectos para reportar.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}

      {editProjectOpen && <Modal title={`Editar proyecto — ${editProjectTarget?.project_number ?? ""}`} onClose={() => setEditProjectOpen(false)}>
        <div className="space-y-3">
          <Field label="Nombre del proyecto" value={editProjectDraft.name} onChange={v => setEditProjectDraft({ ...editProjectDraft, name: v })} />
          <Field label="Referencia del cliente / licitación" value={editProjectDraft.client_reference} onChange={v => setEditProjectDraft({ ...editProjectDraft, client_reference: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block text-xs text-[#5B6670]">Cliente<select value={editProjectDraft.customer_id} onChange={e => setEditProjectDraft({ ...editProjectDraft, customer_id: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm"><option value="">Seleccionar...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="block text-xs text-[#5B6670]">Vendedor asignado<select value={editProjectDraft.user_id} onChange={e => setEditProjectDraft({ ...editProjectDraft, user_id: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm"><option value="">Seleccionar...</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.full_name} · {s.role}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Nombre de contacto (cotización)" value={editProjectDraft.contact_name} onChange={v => setEditProjectDraft({ ...editProjectDraft, contact_name: v })} />
            <Field label="Correo del contacto o cliente" value={editProjectDraft.contact_email} onChange={v => setEditProjectDraft({ ...editProjectDraft, contact_email: v })} />
          </div>
          <label className="block text-xs text-[#5B6670]">Fecha y hora de presentación<input type="datetime-local" value={editProjectDraft.presentation_at} onChange={e => setEditProjectDraft({ ...editProjectDraft, presentation_at: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
          <Field label="Comisión variable (%)" type="number" value={editProjectDraft.commission_percent} onChange={v => setEditProjectDraft({ ...editProjectDraft, commission_percent: v })} />
          <label className="block text-xs text-[#5B6670]">Observaciones<textarea rows={3} value={editProjectDraft.observations} onChange={e => setEditProjectDraft({ ...editProjectDraft, observations: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>
          <button disabled={saving} onClick={saveEditProject} className="w-full py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </Modal>}
    </div>
  </Layout>;
}

function StatCard({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={`rounded-2xl p-4 border ${strong ? "bg-[#0F2647] text-white border-[#0F2647]" : "bg-white"}`}><div className={`text-xs ${strong ? "text-white/70" : "text-[#5B6670]"}`}>{label}</div><div className="text-lg font-semibold mt-1">Bs {money(value)}</div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block text-xs text-[#5B6670]">{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded-xl p-2.5 mt-1 text-sm" /></label>;
}

function Modal({ title, onClose, children }: any) {
  return <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h2 className="font-semibold text-[#0F2647]">{title}</h2><button onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
}
