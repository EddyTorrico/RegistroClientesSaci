import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { Search, Plus, Phone, ClipboardList, X, Mail, Pencil, Trash2 } from "lucide-react";

const TIPOS = ["Ferretería", "Tienda eléctrica", "Distribuidor", "Constructor", "Contratista", "Electricista", "Industria", "Institución", "Otro"];

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

export function Clientes() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdminOrGerente = profile?.role === "admin" || profile?.role === "gerente";
  const puedeEditar = (c: any) => isAdminOrGerente || c.created_by === profile?.id;
  const puedeBorrar = profile?.role === "admin";
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [zona, setZona] = useState("Todas");
  const [ciudad, setCiudad] = useState("Todas");
  const [tipo, setTipo] = useState("Todos");
  const [sortBy, setSortBy] = useState("nombre");
  const [showCrear, setShowCrear] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorCrear, setErrorCrear] = useState("");
  const [errorLista, setErrorLista] = useState("");
  const [form, setForm] = useState({ nombre: "", tipos: [] as string[], zona: "", ciudad: "", direccion: "", telefono: "", email: "" });

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await supabase.from("customers").select("id,name,zone,city,business_types,address,phone,email,created_at,created_by").order("name");
    setClientes(data ?? []);
  }

  function abrirCrear() {
    setEditingId(null);
    setForm({ nombre: "", tipos: [], zona: "", ciudad: "", direccion: "", telefono: "", email: "" });
    setErrorCrear("");
    setShowCrear(true);
  }

  function abrirEditar(c: any) {
    setEditingId(c.id);
    setForm({
      nombre: c.name || "",
      tipos: c.business_types || [],
      zona: c.zone || "",
      ciudad: c.city || "",
      direccion: c.address || "",
      telefono: c.phone || "",
      email: c.email || "",
    });
    setErrorCrear("");
    setShowCrear(true);
  }

  function patch(p: Partial<typeof form>) {
    setForm(f => ({ ...f, ...p }));
  }

  async function guardarCliente() {
    setErrorCrear("");
    if (!form.nombre.trim()) {
      setErrorCrear("El nombre del negocio es obligatorio.");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        name: form.nombre.trim(),
        business_types: form.tipos.length ? form.tipos : null,
        zone: form.zona.trim() || null,
        city: form.ciudad.trim() || null,
        address: form.direccion.trim() || null,
        phone: form.telefono.trim() || null,
        email: form.email.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editingId);
        if (error) throw error;
        setShowCrear(false);
        setEditingId(null);
        await cargar();
      } else {
        const { data, error } = await supabase.from("customers").insert({
          ...payload,
          created_by: profile?.id ?? null,
        }).select().single();
        if (error) throw error;
        setShowCrear(false);
        await cargar();
        if (data?.id) navigate(`/clientes/${data.id}`);
      }
    } catch (e: any) {
      setErrorCrear(e.message || "No fue posible guardar el cliente.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCliente(c: any) {
    setErrorLista("");
    if (!window.confirm(`¿Eliminar el cliente ${c.name}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) {
      if (error.code === "23503") {
        setErrorLista(`No se puede eliminar "${c.name}": tiene visitas, cotizaciones, ventas u otros registros asociados. Si ya no lo usas, puedes dejarlo como está o editarlo.`);
      } else {
        setErrorLista(error.message);
      }
      return;
    }
    await cargar();
  }

  const zonas = ["Todas", ...Array.from(new Set(clientes.map(c => c.zone).filter(Boolean)))];
  const ciudades = ["Todas", ...Array.from(new Set(clientes.map(c => c.city).filter(Boolean)))];
  const tipos = ["Todos", ...Array.from(new Set(clientes.flatMap(c => c.business_types ?? [])))];

  const visibles = clientes.filter(c =>
    (c.name || "").toLowerCase().includes(busqueda.toLowerCase()) &&
    (zona === "Todas" || c.zone === zona) &&
    (ciudad === "Todas" || c.city === ciudad) &&
    (tipo === "Todos" || (c.business_types ?? []).includes(tipo))
  ).sort((a, b) => {
    if (sortBy === "zona") return (a.zone || "").localeCompare(b.zone || "");
    if (sortBy === "tipo") return (a.business_types?.[0] || "").localeCompare(b.business_types?.[0] || "");
    if (sortBy === "registro") return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    return (a.name || "").localeCompare(b.name || "");
  });

  return <Layout title="Clientes" subtitle={`${visibles.length} clientes registrados`}>
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6670]" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por negocio..." className="w-full pl-9 p-2.5 rounded-xl border bg-white text-sm" />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <select value={zona} onChange={e => setZona(e.target.value)} className="border rounded-xl px-2 sm:px-3 py-2.5 sm:py-0 text-sm bg-white"><option value="Todas">Zona: Todas</option>{zonas.slice(1).map(z => <option key={z} value={z}>{z}</option>)}</select>
          <select value={ciudad} onChange={e => setCiudad(e.target.value)} className="border rounded-xl px-2 sm:px-3 py-2.5 sm:py-0 text-sm bg-white"><option value="Todas">Ciudad: Todas</option>{ciudades.slice(1).map(z => <option key={z} value={z}>{z}</option>)}</select>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="border rounded-xl px-2 sm:px-3 py-2.5 sm:py-0 text-sm bg-white"><option value="Todos">Tipo: Todos</option>{tipos.slice(1).map(z => <option key={z} value={z}>{z}</option>)}</select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} title="Ordenar por" className="border rounded-xl px-2 sm:px-3 py-2.5 sm:py-0 text-sm bg-white"><option value="nombre">Ordenar: Negocio</option><option value="zona">Ordenar: Zona</option><option value="tipo">Ordenar: Tipo</option><option value="registro">Ordenar: Registro</option></select>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button onClick={abrirCrear} className="px-4 py-2.5 sm:py-0 rounded-xl border border-[#1B3A6B] text-[#1B3A6B] text-sm bg-white whitespace-nowrap"><Plus size={15} className="inline mr-1" />Crear cliente</button>
          <button onClick={() => navigate("/visitas/nueva")} className="px-4 py-2.5 sm:py-0 rounded-xl bg-[#1B3A6B] text-white text-sm whitespace-nowrap"><ClipboardList size={15} className="inline mr-1" />Registrar visita</button>
        </div>
      </div>

      {errorLista && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{errorLista}</div>}

      {/* Tabla en escritorio */}
      <div className="hidden md:block bg-white rounded-2xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-[#5B6670] border-b"><th className="py-2">Negocio / Razón social</th><th>Zona</th><th>Ciudad</th><th>Tipo</th><th>Dirección</th><th>Teléfono</th><th>Correo</th><th>Registro</th><th className="text-right">Acciones</th></tr></thead>
          <tbody>
            {visibles.map(c => <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="border-b cursor-pointer hover:bg-[#F5F6F8]">
              <td className="py-2.5 font-medium">{c.name}</td>
              <td>{c.zone || "—"}</td>
              <td>{c.city || "—"}</td>
              <td>{(c.business_types ?? []).join(", ") || "—"}</td>
              <td>{c.address || "—"}</td>
              <td>{c.phone ? <span><Phone size={13} className="inline mr-1" />{c.phone}</span> : "—"}</td>
              <td>{c.email ? <span><Mail size={13} className="inline mr-1" />{c.email}</span> : "—"}</td>
              <td>{c.created_at ? new Date(c.created_at).toLocaleDateString("es-BO") : "—"}</td>
              <td onClick={e => e.stopPropagation()}><div className="flex justify-end gap-2">
                {puedeEditar(c) && <button title="Editar cliente" onClick={() => abrirEditar(c)} className="p-2 rounded-lg border text-[#1B3A6B]"><Pencil size={15} /></button>}
                {puedeBorrar && <button title="Eliminar cliente" onClick={() => eliminarCliente(c)} className="p-2 rounded-lg border text-red-600"><Trash2 size={15} /></button>}
                {!puedeEditar(c) && !puedeBorrar && <span className="text-xs text-[#9AA4AF]">—</span>}
              </div></td>
            </tr>)}
            {!visibles.length && <tr><td colSpan={9} className="py-8 text-center italic text-[#5B6670]">Sin resultados.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Tarjetas en celular */}
      <div className="md:hidden space-y-2">
        {visibles.map(c => <div key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="bg-white rounded-2xl p-4 border active:bg-[#F5F6F8]">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-[#0F2647]">{c.name}</div>
            {(puedeEditar(c) || puedeBorrar) && <div onClick={e => e.stopPropagation()} className="flex gap-1 shrink-0">
              {puedeEditar(c) && <button title="Editar cliente" onClick={() => abrirEditar(c)} className="p-1.5 rounded-lg border text-[#1B3A6B]"><Pencil size={14} /></button>}
              {puedeBorrar && <button title="Eliminar cliente" onClick={() => eliminarCliente(c)} className="p-1.5 rounded-lg border text-red-600"><Trash2 size={14} /></button>}
            </div>}
          </div>
          <div className="text-xs text-[#5B6670] mt-1">{c.zone || "Sin zona"}{c.city ? ` · ${c.city}` : ""}</div>
          {(c.business_types ?? []).length > 0 && <div className="text-xs text-[#5B6670] mt-1">{(c.business_types ?? []).join(", ")}</div>}
          {c.address && <div className="text-xs text-[#5B6670] mt-1">{c.address}</div>}
          {c.phone && <div className="text-xs text-[#1B3A6B] mt-1"><Phone size={13} className="inline mr-1" />{c.phone}</div>}
          {c.email && <div className="text-xs text-[#1B3A6B] mt-1"><Mail size={13} className="inline mr-1" />{c.email}</div>}
        </div>)}
        {!visibles.length && <div className="bg-white rounded-2xl p-8 text-center italic text-[#5B6670] text-sm">Sin resultados.</div>}
      </div>
    </div>

    {showCrear && <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-[#0F2647]">{editingId ? "Editar cliente" : "Crear cliente"}</h3>
          <button onClick={() => { setShowCrear(false); setEditingId(null); }}><X size={18} className="text-[#5B6670]" /></button>
        </div>
        {!editingId && <div className="text-xs text-[#5B6670] mb-4">Crea la ficha del negocio sin registrar una visita ahora. Podrás agregar visitas después, desde la ficha del cliente.</div>}

        {errorCrear && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">{errorCrear}</div>}

        <label className="block text-xs text-[#5B6670] mb-3">Negocio / razón social *
          <input value={form.nombre} onChange={e => patch({ nombre: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" placeholder="Nombre del negocio" />
        </label>

        <div className="text-xs text-[#5B6670] mb-1">Tipo de negocio</div>
        <div className="flex flex-wrap mb-3">
          {TIPOS.map(t => <button key={t} type="button" onClick={() => patch({ tipos: toggle(form.tipos, t) })} className={`px-3 py-1.5 rounded-full text-xs border mr-1.5 mb-1.5 ${form.tipos.includes(t) ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#5B6670]"}`}>{t}</button>)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-[#5B6670]">Zona
            <input value={form.zona} onChange={e => patch({ zona: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" placeholder="Ej.: Sur" />
          </label>
          <label className="text-xs text-[#5B6670]">Ciudad
            <input value={form.ciudad} onChange={e => patch({ ciudad: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" placeholder="Ej.: Santa Cruz" />
          </label>
        </div>

        <label className="block text-xs text-[#5B6670] mb-3">Dirección
          <input value={form.direccion} onChange={e => patch({ direccion: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <label className="text-xs text-[#5B6670]">Teléfono
            <input value={form.telefono} onChange={e => patch({ telefono: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" />
          </label>
          <label className="text-xs text-[#5B6670]">Correo electrónico
            <input type="email" value={form.email} onChange={e => patch({ email: e.target.value })} className="w-full border rounded-xl p-2.5 mt-1 text-sm" placeholder="cliente@empresa.com" />
          </label>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setShowCrear(false); setEditingId(null); }} className="flex-1 py-2.5 rounded-xl border text-sm">Cancelar</button>
          <button disabled={guardando} onClick={guardarCliente} className="flex-1 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm disabled:opacity-50">{guardando ? "Guardando..." : editingId ? "Guardar cambios" : "Crear cliente"}</button>
        </div>
      </div>
    </div>}
  </Layout>;
}
