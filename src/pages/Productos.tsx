import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { Plus, Search, PackagePlus, ImagePlus, X, History, Pencil, Boxes, BarChart3, Tags, Trash2 } from "lucide-react";

const emptyForm = {
  sku: "",
  name: "",
  brand: "",
  group_id: "",
  category_id: "",
  unit: "unidad",
  purchase_price: "",
  sale_price: "",
  initial_stock: "",
  image_url: "",
  active: true,
};

const emptyMov = { product_id: "", movement_type: "entrada", quantity: "", reference: "", notes: "" };

const numberFormatter = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmt(value: any) { return numberFormatter.format(Number(value || 0)); }
function money(value: any) { return moneyFormatter.format(Number(value || 0)); }
function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function movementLabel(type: string) {
  const labels: Record<string, string> = {
    inicial: "Saldo inicial",
    entrada: "Entrada",
    salida: "Salida",
    venta: "Venta",
    ajuste_entrada: "Ajuste entrada",
    ajuste_salida: "Ajuste salida",
  };
  return labels[type] || type;
}

function movementSign(type: string) {
  return ["inicial", "entrada", "ajuste_entrada"].includes(type) ? 1 : -1;
}

export function Productos() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("Todas");
  const [showProjectPending, setShowProjectPending] = useState(false);
  const [section, setSection] = useState<"products" | "inventory">("products");
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [newSubgroup, setNewSubgroup] = useState("");
  const [subgroupParentId, setSubgroupParentId] = useState("");
  const [historyProduct, setHistoryProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [movementUsers, setMovementUsers] = useState<any[]>([]);
  const [invPeriod, setInvPeriod] = useState<"day" | "month" | "year">("month");
  const [invDate, setInvDate] = useState(todayIso().slice(0, 7));
  const [invSearch, setInvSearch] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [mov, setMov] = useState(emptyMov);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = profile?.role !== "vendedor";

  useEffect(() => { load(); }, []);
  useEffect(() => { if (section === "inventory") loadInventory(); }, [section, invPeriod, invDate]);

  async function load() {
    const [{ data: cats }, { data: prods, error: pe }] = await Promise.all([
      supabase.from("categories").select("id,name,parent_id").order("name"),
      supabase.from("product_inventory").select("*").order("name"),
    ]);
    if (pe) setError(pe.message);
    setCategories(cats ?? []);
    setProducts(prods ?? []);
  }

  function inventoryRange() {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (invPeriod === "day") {
      const [y, m, d] = invDate.split("-").map(Number);
      start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
      end = new Date(y, (m || 1) - 1, (d || 1) + 1, 0, 0, 0, 0);
    } else if (invPeriod === "month") {
      const [y, m] = invDate.split("-").map(Number);
      start = new Date(y || now.getFullYear(), (m || 1) - 1, 1, 0, 0, 0, 0);
      end = new Date(y || now.getFullYear(), m || 1, 1, 0, 0, 0, 0);
    } else {
      const y = Number(invDate) || now.getFullYear();
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function loadInventory() {
    setInventoryLoading(true);
    setError("");
    const { start, end } = inventoryRange();
    const [mResult, uResult] = await Promise.all([
      supabase
        .from("inventory_movements")
        .select("id,product_id,movement_type,quantity,reference,notes,created_by,created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);
    if (mResult.error) setError(mResult.error.message);
    else setAllMovements(mResult.data ?? []);
    if (!uResult.error) setMovementUsers(uResult.data ?? []);
    setInventoryLoading(false);
  }

  function newProduct() {
    setError("");
    setEditingProduct(null);
    setForm(emptyForm);
    setFile(null);
    setOpen(true);
  }

  function editProduct(product: any) {
    setError("");
    setEditingProduct(product);
    const currentCategory = categories.find(c => c.id === product.category_id);
    setForm({
      sku: product.sku ?? "",
      name: product.name ?? "",
      brand: product.brand ?? "",
      group_id: currentCategory?.parent_id ? currentCategory.parent_id : (currentCategory?.id ?? ""),
      category_id: currentCategory?.parent_id ? currentCategory.id : "",
      unit: product.unit ?? "unidad",
      purchase_price: String(product.purchase_price ?? ""),
      sale_price: String(product.sale_price ?? ""),
      initial_stock: "",
      image_url: product.image_url ?? "",
      active: product.active !== false,
    });
    setFile(null);
    setOpen(true);
  }

  async function uploadImage(productId: string) {
    if (!file) return null;
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    const path = `${productId}/${Date.now()}-${safeName}`;
    const { error: ue } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (ue) throw ue;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  const groups = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const subgroupsForForm = useMemo(() => categories.filter(c => c.parent_id === form.group_id), [categories, form.group_id]);

  function categoryPath(categoryId: string | null | undefined) {
    if (!categoryId) return "Sin categoría";
    const category = categories.find(c => c.id === categoryId);
    if (!category) return "Sin categoría";
    if (!category.parent_id) return category.name;
    const parent = categories.find(c => c.id === category.parent_id);
    return parent ? `${parent.name} / ${category.name}` : category.name;
  }

  async function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    setError("");
    const { data, error } = await supabase.from("categories").insert({ name, parent_id: null }).select("id,name,parent_id").single();
    if (error) return setError(error.message);
    setCategories(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    setForm(prev => ({ ...prev, group_id: data.id, category_id: "" }));
    setSubgroupParentId(data.id);
    setNewGroup("");
  }

  async function addSubgroup() {
    const name = newSubgroup.trim();
    if (!name || !subgroupParentId) {
      setError("Selecciona un grupo e ingresa el nombre del subgrupo.");
      return;
    }
    setError("");
    const { data, error } = await supabase.from("categories").insert({ name, parent_id: subgroupParentId }).select("id,name,parent_id").single();
    if (error) return setError(error.message);
    setCategories(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    setForm(prev => prev.group_id === subgroupParentId ? { ...prev, category_id: data.id } : prev);
    setNewSubgroup("");
  }

  async function renameCategory(c: any) {
    const type = c.parent_id ? "subgrupo" : "grupo";
    const name = window.prompt(`Nuevo nombre del ${type}`, c.name)?.trim();
    if (!name || name === c.name) return;
    const { error } = await supabase.from("categories").update({ name }).eq("id", c.id);
    if (error) return setError(error.message);
    await load();
  }

  async function deleteCategory(c: any) {
    if (!c.parent_id && categories.some(x => x.parent_id === c.id)) {
      setError("No se puede eliminar un grupo que todavía tiene subgrupos. Elimina o reasigna primero sus subgrupos.");
      return;
    }
    const type = c.parent_id ? "subgrupo" : "grupo";
    if (!window.confirm(`¿Eliminar el ${type} ${c.name}? Los productos asociados quedarán sin esa clasificación.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return setError(error.message);
    if (form.category_id === c.id || form.group_id === c.id) setForm(prev => ({ ...prev, group_id: "", category_id: "" }));
    await load();
  }

  async function deleteProduct(p: any) {
    setError("");
    const { count: movCount } = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("product_id", p.product_id);

    const warning = movCount
      ? ` Este producto tiene ${movCount} movimiento(s) de inventario registrados — eliminarlo también borrará ese historial de forma permanente.`
      : "";
    if (!window.confirm(`¿Eliminar el producto ${p.sku} · ${p.name}?${warning} Esta acción no se puede deshacer. Si solo quieres que deje de estar disponible para cotizar o vender, es más seguro desactivarlo (editar → desmarcar "Activo").`)) return;

    const { error } = await supabase.from("products").delete().eq("id", p.product_id);
    if (error) {
      if (error.code === "23503") {
        setError(`No se puede eliminar "${p.name}": está usado en cotizaciones, ventas o compras de proyecto ya registradas. Desactívalo en lugar de eliminarlo (editar → desmarcar "Activo").`);
      } else {
        setError(error.message);
      }
      return;
    }
    await load();
  }

  async function saveProduct() {
    setError("");
    if (!profile || !form.sku.trim() || !form.name.trim()) {
      setError("Código SACIPETROL y Nombre / Descripción / Especificaciones son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: null,
        brand: form.brand.trim() || null,
        category_id: form.category_id || form.group_id || null,
        unit: form.unit.trim() || "unidad",
        purchase_price: Number(form.purchase_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        active: form.active,
      };

      let productId = editingProduct?.product_id as string | undefined;

      if (editingProduct) {
        const { error: pe } = await supabase.from("products").update(payload).eq("id", productId);
        if (pe) throw pe;
      } else {
        const { data: p, error: pe } = await supabase.from("products").insert(payload).select("id").single();
        if (pe) throw pe;
        productId = p.id;
      }

      if (!productId) throw new Error("No fue posible identificar el producto.");

      if (file) {
        const url = await uploadImage(productId);
        const { error: ie } = await supabase.from("products").update({ image_url: url }).eq("id", productId);
        if (ie) throw ie;
      }

      if (!editingProduct) {
        const initial = Number(form.initial_stock);
        if (initial > 0) {
          const { error: me } = await supabase.from("inventory_movements").insert({
            product_id: productId,
            movement_type: "inicial",
            quantity: initial,
            reference: "Alta de producto",
            notes: "Saldo inicial registrado al crear el producto",
            created_by: profile.id,
          });
          if (me) throw me;
        }
      }

      setOpen(false);
      setEditingProduct(null);
      setForm(emptyForm);
      setFile(null);
      await load();
      if (section === "inventory") await loadInventory();
    } catch (e: any) {
      setError(e.message || "No fue posible guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMovement() {
    setError("");
    if (!profile || !mov.product_id || Number(mov.quantity) <= 0) {
      setError("Selecciona un producto e indica una cantidad mayor que cero.");
      return;
    }
    setSaving(true);
    const { error: e } = await supabase.from("inventory_movements").insert({
      ...mov,
      quantity: Number(mov.quantity),
      created_by: profile.id,
    });
    if (e) setError(e.message);
    else {
      setMovementOpen(false);
      setMov(emptyMov);
      await load();
      if (section === "inventory") await loadInventory();
    }
    setSaving(false);
  }

  async function showHistory(product: any) {
    setHistoryProduct(product);
    const { data, error: e } = await supabase
      .from("inventory_movements")
      .select("id,movement_type,quantity,reference,notes,created_at,created_by")
      .eq("product_id", product.product_id)
      .order("created_at", { ascending: false });
    if (e) setError(e.message);
    else setMovements(data ?? []);
  }

  const rows = useMemo(() => products.filter(p => {
    const text = `${p.sku} ${p.name} ${p.brand || ""}`.toLowerCase();
    return text.includes(q.toLowerCase())
      && (categoryId === "Todas" || p.category_id === categoryId)
      && (showProjectPending || !p.is_project_product);
  }), [products, q, categoryId, showProjectPending]);

  const filteredInventoryMovements = useMemo(() => {
    const needle = invSearch.trim().toLowerCase();
    return allMovements.filter(m => {
      const p = products.find(x => x.product_id === m.product_id);
      const text = `${p?.sku || ""} ${p?.name || ""} ${movementLabel(m.movement_type)} ${m.reference || ""} ${m.notes || ""}`.toLowerCase();
      return !needle || text.includes(needle);
    });
  }, [allMovements, products, invSearch]);

  const inventoryTotals = useMemo(() => {
    const totals: Record<string, number> = { inicial: 0, entrada: 0, salida: 0, venta: 0, ajuste_entrada: 0, ajuste_salida: 0 };
    filteredInventoryMovements.forEach(m => { totals[m.movement_type] = (totals[m.movement_type] || 0) + Number(m.quantity || 0); });
    const diferencia = totals.ajuste_entrada - totals.ajuste_salida;
    const net = totals.inicial + totals.entrada + totals.ajuste_entrada - totals.salida - totals.venta - totals.ajuste_salida;
    return { ...totals, diferencia, net };
  }, [filteredInventoryMovements]);

  const inventoryByProduct = useMemo(() => {
    const map = new Map<string, any>();
    filteredInventoryMovements.forEach(m => {
      const p = products.find(x => x.product_id === m.product_id);
      const key = m.product_id;
      if (!map.has(key)) map.set(key, { product_id: key, sku: p?.sku || "—", name: p?.name || "Producto", inicial: 0, entrada: 0, salida: 0, venta: 0, ajuste_entrada: 0, ajuste_salida: 0, diferencia: 0, net: 0 });
      const row = map.get(key);
      row[m.movement_type] += Number(m.quantity || 0);
      row.diferencia = row.ajuste_entrada - row.ajuste_salida;
      row.net += movementSign(m.movement_type) * Number(m.quantity || 0);
    });
    return Array.from(map.values()).sort((a, b) => a.sku.localeCompare(b.sku));
  }, [filteredInventoryMovements, products]);

  return <Layout title="Productos" subtitle="Productos, precios, imágenes y control de inventario">
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSection("products")} className={`px-4 py-2.5 rounded-xl text-sm border ${section === "products" ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#0F2647]"}`}><Boxes size={15} className="inline mr-1"/>Productos</button>
        <button onClick={() => setSection("inventory")} className={`px-4 py-2.5 rounded-xl text-sm border ${section === "inventory" ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#0F2647]"}`}><BarChart3 size={15} className="inline mr-1"/>Movimientos de inventario</button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}

      {section === "products" && <>
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]"/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por código, nombre, descripción o marca..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-white text-sm"/>
          </div>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="border rounded-xl px-3 py-2.5 bg-white text-sm lg:w-52">
            <option value="Todas">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {canEdit && <button onClick={newProduct} className="px-4 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm"><Plus size={15} className="inline mr-1"/>Nuevo producto</button>}
        </div>
        <label className="flex items-center gap-2 text-xs text-[#5B6670]">
          <input type="checkbox" checked={showProjectPending} onChange={e => setShowProjectPending(e.target.checked)} />
          Mostrar productos de proyecto pendientes de compra (aún no ingresaron a inventario)
        </label>

        <div className="bg-white rounded-2xl p-5 overflow-x-auto" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06), 0 1px 12px rgba(15,38,71,0.04)" }}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Imagen</th><th>Código</th><th>Nombre / Descripción / Especificaciones</th><th>Marca</th><th>Categoría</th><th className="text-right">Precio venta</th><th className="text-right">Stock</th>{canEdit && <th>Acciones</th>}</tr></thead>
            <tbody>
              {rows.map(p => <tr key={p.product_id} className="border-b hover:bg-[#FAFBFC]">
                <td className="py-2.5">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-11 h-11 object-contain rounded-lg border bg-white"/> : <div className="w-11 h-11 rounded-lg border flex items-center justify-center text-[#9AA4AF]"><ImagePlus size={17}/></div>}</td>
                <td className="font-mono text-xs">{p.sku}</td>
                <td className="font-medium text-[#0F2647]">{p.name}{p.is_project_product && <span className="ml-2 align-middle text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Pendiente de compra</span>}</td>
                <td>{p.brand || "—"}</td>
                <td>{categoryPath(p.category_id)}</td>
                <td className="text-right whitespace-nowrap">Bs {money(p.sale_price)}</td>
                <td className="text-right"><span className={`font-semibold ${Number(p.stock) <= 0 ? "text-red-600" : Number(p.stock) <= 5 ? "text-amber-600" : "text-[#3E7A56]"}`}>{fmt(p.stock)} {p.unit || ""}</span></td>
                {canEdit && <td><div className="flex gap-3">
                  <button title="Editar producto" onClick={() => editProduct(p)} className="text-[#1B3A6B]"><Pencil size={16}/></button>
                  <button title="Movimiento de stock" onClick={() => { setMov({ ...emptyMov, product_id: p.product_id }); setMovementOpen(true); }} className="text-[#1B3A6B]"><PackagePlus size={16}/></button>
                  <button title="Historial" onClick={() => showHistory(p)} className="text-[#5B6670]"><History size={16}/></button>
                  <button title="Eliminar producto" onClick={() => deleteProduct(p)} className="text-red-600"><Trash2 size={16}/></button>
                </div></td>}
              </tr>)}
              {rows.length === 0 && <tr><td colSpan={canEdit ? 8 : 7} className="py-8 text-center italic text-[#5B6670]">No se encontraron productos.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}

      {section === "inventory" && <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#0F2647]">Resumen de movimientos</div>
              <div className="text-xs text-[#5B6670]">Se cargan exclusivamente los movimientos comprendidos en el periodo seleccionado. El buscador filtra únicamente dentro de ese periodo.</div>
            </div>
            <label className="text-xs text-[#5B6670]">Periodo
              <select value={invPeriod} onChange={e => { const next = e.target.value as any; setInvPeriod(next); const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0"); setInvDate(next === "day" ? `${y}-${m}-${day}` : next === "month" ? `${y}-${m}` : `${y}`); }} className="block border rounded-xl px-3 py-2.5 bg-white text-sm mt-1 min-w-36">
                <option value="day">Día</option><option value="month">Mes</option><option value="year">Año</option>
              </select>
            </label>
            <label className="text-xs text-[#5B6670]">Fecha de referencia
              <input type={invPeriod === "day" ? "date" : invPeriod === "month" ? "month" : "number"} min={invPeriod === "year" ? "2000" : undefined} max={invPeriod === "year" ? "2100" : undefined} value={invDate} onChange={e => setInvDate(e.target.value)} className="block border rounded-xl px-3 py-2 bg-white text-sm mt-1"/>
            </label>
            <div className="relative lg:w-80">
              <Search size={15} className="absolute left-3 bottom-3 text-[#5B6670]"/>
              <input value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Buscar producto, referencia..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-white text-sm"/>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <SummaryCard label="Saldo inicial" value={inventoryTotals.inicial} />
          <SummaryCard label="Entradas" value={inventoryTotals.entrada} />
          <SummaryCard label="Ventas" value={inventoryTotals.venta} />
          <SummaryCard label="Salidas" value={inventoryTotals.salida} />
          <SummaryCard label="Ajuste entrada" value={inventoryTotals.ajuste_entrada} />
          <SummaryCard label="Ajuste salida" value={inventoryTotals.ajuste_salida} />
          <SummaryCard label="Diferencia ajustes" value={inventoryTotals.diferencia} />
          <SummaryCard label="Movimiento neto" value={inventoryTotals.net} strong />
        </div>

        <div className="bg-white rounded-2xl p-5 overflow-x-auto">
          <div className="font-semibold text-sm mb-3">Resumen por producto</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Código</th><th>Producto</th><th className="text-right">Inicial</th><th className="text-right">Entradas</th><th className="text-right">Ventas</th><th className="text-right">Salidas</th><th className="text-right">Aj. entrada</th><th className="text-right">Aj. salida</th><th className="text-right">Diferencia</th><th className="text-right">Neto periodo</th></tr></thead>
            <tbody>{inventoryByProduct.map(r => <tr key={r.product_id} className="border-b"><td className="py-2 font-mono text-xs">{r.sku}</td><td>{r.name}</td><td className="text-right">{fmt(r.inicial)}</td><td className="text-right">{fmt(r.entrada)}</td><td className="text-right">{fmt(r.venta)}</td><td className="text-right">{fmt(r.salida)}</td><td className="text-right">{fmt(r.ajuste_entrada)}</td><td className="text-right">{fmt(r.ajuste_salida)}</td><td className={`text-right font-semibold ${r.diferencia < 0 ? "text-red-600" : "text-[#3E7A56]"}`}>{fmt(r.diferencia)}</td><td className={`text-right font-semibold ${r.net < 0 ? "text-red-600" : "text-[#3E7A56]"}`}>{fmt(r.net)}</td></tr>)}
            {inventoryByProduct.length === 0 && <tr><td colSpan={10} className="py-8 text-center italic text-[#5B6670]">Sin movimientos para el periodo seleccionado.</td></tr>}</tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl p-5 overflow-x-auto">
          <div className="flex justify-between items-center mb-3"><div className="font-semibold text-sm">Detalle de movimientos</div><div className="text-xs text-[#5B6670]">{filteredInventoryMovements.length} registros</div></div>
          {inventoryLoading ? <div className="py-8 text-center text-sm text-[#5B6670]">Cargando movimientos...</div> : <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Fecha</th><th>Código</th><th>Producto</th><th>Tipo</th><th className="text-right">Cantidad</th><th>Referencia</th><th>Usuario</th><th>Observaciones</th></tr></thead>
            <tbody>{filteredInventoryMovements.map(m => {
              const p = products.find(x => x.product_id === m.product_id);
              const u = movementUsers.find(x => x.id === m.created_by);
              const positive = movementSign(m.movement_type) > 0;
              return <tr key={m.id} className="border-b align-top"><td className="py-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString("es-BO")}</td><td className="font-mono text-xs">{p?.sku || "—"}</td><td className="min-w-48">{p?.name || "—"}</td><td>{movementLabel(m.movement_type)}</td><td className={`text-right font-semibold ${positive ? "text-[#3E7A56]" : "text-red-600"}`}>{positive ? "+" : "−"}{fmt(m.quantity)}</td><td>{m.reference || "—"}</td><td>{u?.full_name || "—"}</td><td>{m.notes || "—"}</td></tr>;
            })}
            {filteredInventoryMovements.length === 0 && <tr><td colSpan={8} className="py-8 text-center italic text-[#5B6670]">Sin movimientos.</td></tr>}</tbody>
          </table>}
        </div>
      </div>}

      {open && <Modal title={editingProduct ? `Editar producto — ${editingProduct.sku}` : "Nuevo producto"} onClose={() => { setOpen(false); setEditingProduct(null); }}>
        <div className="space-y-3">
          {form.image_url && <div className="flex items-center gap-3"><img src={form.image_url} alt="Producto" className="w-20 h-20 object-contain rounded-xl border"/><div className="text-xs text-[#5B6670]">Imagen actual</div></div>}
          <label className="block text-xs text-[#5B6670]">{editingProduct ? "Cambiar imagen (opcional)" : "Imagen del producto"}<input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full border rounded-xl p-2 mt-1 text-sm"/>{file && <div className="text-xs mt-1">Seleccionada: {file.name}</div>}</label>
          <Field label="Código SACIPETROL" value={form.sku} onChange={v => setForm({ ...form, sku: v })} />
          <label className="block text-xs text-[#5B6670]">Nombre / Descripción / Especificaciones<textarea value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} rows={5} className="w-full border rounded-xl p-2.5 mt-1 text-sm"/></label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Marca" value={form.brand} onChange={v => setForm({ ...form, brand: v })}/>
            <div className="space-y-2">
              <label className="block text-xs text-[#5B6670]">Grupo<div className="flex gap-1 mt-1"><select value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value, category_id: "" })} className="w-full border rounded-xl p-2.5 text-sm"><option value="">Sin grupo</option>{groups.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{canEdit && <button type="button" title="Administrar grupos y subgrupos" onClick={() => { setSubgroupParentId(form.group_id || groups[0]?.id || ""); setCategoryOpen(true); }} className="px-3 rounded-xl border text-[#1B3A6B]"><Tags size={16}/></button>}</div></label>
              <label className="block text-xs text-[#5B6670]">Subgrupo<select disabled={!form.group_id} value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm disabled:bg-gray-100"><option value="">Sin subgrupo</option>{subgroupsForForm.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Unidad" value={form.unit} onChange={v => setForm({ ...form, unit: v })}/>
            {!editingProduct ? <Field label="Saldo inicial en stock" type="number" value={form.initial_stock} onChange={v => setForm({ ...form, initial_stock: v })}/> : <div className="text-xs text-[#5B6670] border rounded-xl p-3 mt-4">Stock actual: <b>{fmt(editingProduct.stock)}</b>. Para modificarlo use Movimiento de stock.</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Precio de compra" type="number" value={form.purchase_price} onChange={v => setForm({ ...form, purchase_price: v })}/>
            <Field label="Precio de venta" type="number" value={form.sale_price} onChange={v => setForm({ ...form, sale_price: v })}/>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}/> Producto activo</label>
          <button disabled={saving} onClick={saveProduct} className="w-full py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Guardando..." : editingProduct ? "Guardar cambios" : "Guardar producto"}</button>
        </div>
      </Modal>}

      {movementOpen && <Modal title="Movimiento de stock" onClose={() => setMovementOpen(false)}><div className="space-y-3"><label className="block text-xs text-[#5B6670]">Tipo<select value={mov.movement_type} onChange={e => setMov({ ...mov, movement_type: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm"><option value="entrada">Entrada</option><option value="salida">Salida</option><option value="venta">Venta</option><option value="ajuste_entrada">Ajuste entrada</option><option value="ajuste_salida">Ajuste salida</option></select></label><Field label="Cantidad" type="number" value={mov.quantity} onChange={v => setMov({ ...mov, quantity: v })}/><Field label="Referencia" value={mov.reference} onChange={v => setMov({ ...mov, reference: v })}/><Field label="Observaciones" value={mov.notes} onChange={v => setMov({ ...mov, notes: v })}/><button disabled={saving} onClick={saveMovement} className="w-full py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{saving ? "Guardando..." : "Registrar movimiento"}</button></div></Modal>}

      {categoryOpen && <Modal title="Administrar grupos y subgrupos" onClose={() => setCategoryOpen(false)}>
        <div className="space-y-5">
          <div className="border rounded-xl p-3">
            <div className="text-sm font-semibold text-[#0F2647] mb-2">Crear grupo</div>
            <div className="flex gap-2"><input value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="Ej.: Automatización" className="flex-1 border rounded-xl p-2.5 text-sm"/><button onClick={addGroup} className="px-4 rounded-xl bg-[#1B3A6B] text-white text-sm">Crear grupo</button></div>
          </div>
          <div className="border rounded-xl p-3">
            <div className="text-sm font-semibold text-[#0F2647] mb-2">Crear subgrupo</div>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
              <select value={subgroupParentId} onChange={e => setSubgroupParentId(e.target.value)} className="border rounded-xl p-2.5 text-sm"><option value="">Seleccionar grupo</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <input value={newSubgroup} onChange={e => setNewSubgroup(e.target.value)} placeholder="Ej.: Interruptores WiFi" className="border rounded-xl p-2.5 text-sm"/>
              <button onClick={addSubgroup} className="px-4 rounded-xl bg-[#1B3A6B] text-white text-sm">Crear subgrupo</button>
            </div>
          </div>
          <div className="max-h-80 overflow-auto space-y-3">
            {groups.map(g => <div key={g.id} className="border rounded-xl p-3">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm">{g.name}</span><div className="flex gap-2"><button onClick={() => renameCategory(g)} className="p-2 border rounded-lg text-[#1B3A6B]" title="Renombrar grupo"><Pencil size={14}/></button><button onClick={() => deleteCategory(g)} className="p-2 border rounded-lg text-red-600" title="Eliminar grupo"><Trash2 size={14}/></button></div></div>
              <div className="mt-2 pl-3 border-l space-y-1">{categories.filter(c => c.parent_id === g.id).map(sg => <div key={sg.id} className="flex items-center justify-between py-1"><span className="text-sm text-[#5B6670]">{sg.name}</span><div className="flex gap-2"><button onClick={() => renameCategory(sg)} className="p-1.5 border rounded-lg text-[#1B3A6B]" title="Renombrar subgrupo"><Pencil size={13}/></button><button onClick={() => deleteCategory(sg)} className="p-1.5 border rounded-lg text-red-600" title="Eliminar subgrupo"><Trash2 size={13}/></button></div></div>)}{categories.filter(c => c.parent_id === g.id).length === 0 && <div className="text-xs italic text-[#5B6670] py-1">Sin subgrupos</div>}</div>
            </div>)}
            {groups.length === 0 && <div className="text-sm italic text-[#5B6670]">Todavía no existen grupos.</div>}
          </div>
        </div>
      </Modal>}

      {historyProduct && <Modal title={`Historial — ${historyProduct.sku}`} onClose={() => setHistoryProduct(null)}><div className="mb-3 text-sm font-medium">{historyProduct.name}<div className="text-xs text-[#5B6670]">Stock actual: {fmt(historyProduct.stock)} {historyProduct.unit || ""}</div></div><div className="max-h-80 overflow-auto space-y-2">{movements.map(m => <div key={m.id} className="border rounded-xl p-3 text-sm"><div className="flex justify-between"><b>{movementLabel(m.movement_type)}</b><span>{fmt(m.quantity)}</span></div><div className="text-xs text-[#5B6670]">{new Date(m.created_at).toLocaleString("es-BO")}{m.reference ? ` · ${m.reference}` : ""}</div>{m.notes && <div className="text-xs mt-1">{m.notes}</div>}</div>)}{movements.length === 0 && <div className="text-sm italic text-[#5B6670]">Sin movimientos.</div>}</div></Modal>}
    </div>
  </Layout>;
}

function SummaryCard({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={`rounded-2xl p-4 border ${strong ? "bg-[#0F2647] text-white border-[#0F2647]" : "bg-white"}`}><div className={`text-xs ${strong ? "text-white/70" : "text-[#5B6670]"}`}>{label}</div><div className="text-xl font-semibold mt-1">{fmt(value)}</div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block text-xs text-[#5B6670]">{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded-xl p-2.5 mt-1 text-sm"/></label>;
}

function Modal({ title, onClose, children }: any) {
  return <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h2 className="font-semibold text-[#0F2647]">{title}</h2><button onClick={onClose}><X size={18}/></button></div>{children}</div></div>;
}
