import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { MapPin, Camera, Check, ChevronLeft, ChevronRight, UserRound, Phone, Mail, X } from "lucide-react";

const STEPS = ["Cliente", "Contacto", "Ubicación", "Productos", "Proveedor", "Oportunidad", "Resultado"];
const TIPOS = ["Ferretería", "Tienda eléctrica", "Distribuidor", "Constructor", "Contratista", "Electricista", "Industria", "Institución", "Otro"];
const RAZONES = ["Precio", "Crédito", "Disponibilidad", "Marca", "Rapidez", "Cercanía", "Calidad", "Servicio"];
const RESULTADOS = ["Solo levantamiento de información", "Cliente interesado", "Solicita cotización", "Solicita catálogo", "Solicita visita técnica", "Compra inmediata", "Requiere seguimiento", "No interesado", "No se encontró al responsable"];
const input = "border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/20";

export function NuevaVisita() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [clientes, setClientes] = useState<any[]>([]);
  const [modo, setModo] = useState<"nuevo" | "existente">("nuevo");
  const [clienteId, setClienteId] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const fotoPreview = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview); }, [fotoPreview]);
  const [coords, setCoords] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nombre: "", tipos: [] as string[], contactoNombre: "", contactoCargo: "", telefono: "", whatsapp: "", email: "", decisor: "sí",
    direccion: "", zona: "", ciudad: "Santa Cruz de la Sierra", productos: [] as any[], proveedor: "", razones: [] as string[],
    oportunidad: false, necesidad: "", monto: "", interes: "Medio" as "Bajo" | "Medio" | "Alto", resultados: [] as string[],
    accion: "Llamar", fecha: "", nota: ""
  });

  useEffect(() => {
    supabase
      .from("customers")
      .select("id,name,business_types,zone,city,address,phone,latitude,longitude,customer_contacts(id,name,position,phone,whatsapp,email,is_decision_maker,created_at)")
      .order("name")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setClientes(data ?? []);
      });
  }, []);

  const patch = (x: any) => setForm(f => ({ ...f, ...x }));
  function toggle(arr: string[], v: string) { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
  function gps() {
    if (!navigator.geolocation) return setError("El navegador no permite GPS.");
    navigator.geolocation.getCurrentPosition(
      p => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("No se pudo obtener la ubicación GPS. Puedes continuar sin ella.")
    );
  }
  function addProd() { patch({ productos: [...form.productos, { descripcion: "", frecuencia: "Semanal", marca: "", cantidad: "", unidad: "unidad" }] }); }

  function selectExistingCustomer(id: string) {
    setClienteId(id);
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    const contacts = [...(c.customer_contacts ?? [])].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
    const primary = contacts[0];
    patch({
      nombre: c.name || "",
      tipos: c.business_types || [],
      zona: c.zone || "",
      ciudad: c.city || "Santa Cruz de la Sierra",
      direccion: c.address || "",
      telefono: primary?.phone || c.phone || "",
      contactoNombre: primary?.name || "",
      contactoCargo: primary?.position || "",
      whatsapp: primary?.whatsapp || "",
      email: primary?.email || "",
      decisor: primary?.is_decision_maker || "sí",
    });
    if (c.latitude != null && c.longitude != null) setCoords({ lat: Number(c.latitude), lng: Number(c.longitude) });
  }

  async function save() {
    if (!profile) return;
    setError("");
    if (modo === "nuevo" && !form.nombre.trim()) return setError("Ingresa el nombre del negocio.");
    if (modo === "existente" && !clienteId) return setError("Selecciona un cliente.");
    if (form.oportunidad && !form.necesidad.trim()) return setError("Describe la oportunidad comercial.");
    setGuardando(true);
    try {
      let cid = clienteId;
      if (modo === "nuevo") {
        const { data, error: e } = await supabase.from("customers").insert({
          name: form.nombre, business_types: form.tipos, zone: form.zona, city: form.ciudad, address: form.direccion, phone: form.telefono,
          latitude: coords?.lat ?? null, longitude: coords?.lng ?? null, created_by: profile.id
        }).select().single();
        if (e) throw e;
        cid = data.id;
      } else {
        const { error: e } = await supabase.from("customers").update({
          business_types: form.tipos, address: form.direccion, phone: form.telefono, zone: form.zona, city: form.ciudad,
          latitude: coords?.lat ?? undefined, longitude: coords?.lng ?? undefined
        }).eq("id", cid);
        if (e) throw e;
      }

      if (form.contactoNombre) {
        const { error: e } = await supabase.from("customer_contacts").insert({
          customer_id: cid, name: form.contactoNombre, position: form.contactoCargo, phone: form.telefono,
          whatsapp: form.whatsapp, email: form.email, is_decision_maker: form.decisor
        });
        if (e) throw e;
      }

      // La foto se sube aparte (Storage) del resto de la visita (base de
      // datos): si la subida falla, no bloqueamos el guardado de toda la
      // visita (eso podría duplicar el cliente si el usuario reintenta desde
      // cero) — en vez de eso avisamos claramente con una alerta, ya que la
      // pantalla cambia de inmediato al guardar y el aviso en pantalla no
      // alcanzaría a verse.
      let photoUrl = null;
      if (foto) {
        const path = `${cid}/${Date.now()}-${foto.name}`;
        const { error: e } = await supabase.storage.from("visit-photos").upload(path, foto);
        if (e) {
          window.alert(`La visita se está guardando, pero la fotografía NO se pudo subir (${e.message}). El resto de los datos de la visita sí se guardarán.`);
        } else {
          photoUrl = supabase.storage.from("visit-photos").getPublicUrl(path).data.publicUrl;
        }
      }

      for (const p of form.productos) {
        if (p.descripcion.trim()) await supabase.from("customer_products").insert({
          customer_id: cid, description: p.descripcion, frequency: p.frecuencia,
          approx_quantity: p.cantidad ? Number(p.cantidad) : null, unit: p.unidad, usual_brand: p.marca, supplier: form.proveedor
        });
      }

      let opportunityId = null;
      if (form.oportunidad) {
        const { data: o, error: e } = await supabase.from("opportunities").insert({
          customer_id: cid, user_id: profile.id, title: form.necesidad,
          valor_estimado: form.monto ? Number(form.monto) : 0,
          probabilidad: form.interes === "Alto" ? 70 : form.interes === "Medio" ? 40 : 20,
          estado: "detectada", next_action_date: form.fecha || null
        }).select().single();
        if (e) throw e;
        opportunityId = o.id;
      }

      const { error: e } = await supabase.from("visits").insert({
        customer_id: cid, user_id: profile.id, latitude: coords?.lat ?? null, longitude: coords?.lng ?? null,
        address: form.direccion, zone: form.zona, photo_url: photoUrl, provider_name: form.proveedor, provider_reasons: form.razones,
        need_description: form.necesidad, estimated_amount: form.monto ? Number(form.monto) : null, interest_level: form.interes,
        result: form.resultados.join("; "), result_options: form.resultados, opportunity_detected: form.oportunidad, opportunity_id: opportunityId,
        next_action_type: form.oportunidad && form.fecha ? form.accion : null,
        next_action_date: form.oportunidad && form.fecha ? form.fecha : null,
        next_action_note: form.oportunidad && form.fecha ? form.nota : null
      });
      if (e) throw e;
      navigate(`/clientes/${cid}`);
    } catch (e: any) {
      setError(e.message ?? "No se pudo guardar la visita.");
    } finally {
      setGuardando(false);
    }
  }

  const selected = clientes.find(c => c.id === clienteId);
  const selectedContacts = selected?.customer_contacts ?? [];

  return <Layout title="Nueva visita" subtitle={`Paso ${step + 1} de ${STEPS.length}: ${STEPS[step]}`}>
    <div className="max-w-2xl">
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      {step === 0 && <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setModo("nuevo")} className={`px-4 py-2 rounded-xl text-sm border ${modo === "nuevo" ? "bg-[#1B3A6B] text-white" : "bg-white"}`}>Nuevo cliente</button>
          <button onClick={() => setModo("existente")} className={`px-4 py-2 rounded-xl text-sm border ${modo === "existente" ? "bg-[#1B3A6B] text-white" : "bg-white"}`}>Cliente existente</button>
        </div>
        {modo === "existente" ? <>
          <select value={clienteId} onChange={e => selectExistingCustomer(e.target.value)} className={`${input} w-full`}>
            <option value="">Seleccionar cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.zone || ""}</option>)}
          </select>
          {selected && <div className="rounded-2xl border bg-white p-4 space-y-2 text-sm">
            <div className="font-semibold text-[#0F2647]">Datos cargados del cliente</div>
            <div className="grid md:grid-cols-2 gap-2 text-[#5B6670]">
              <div><MapPin size={14} className="inline mr-1"/><b>Dirección:</b> {selected.address || "—"}</div>
              <div><b>Zona / Ciudad:</b> {selected.zone || "—"} / {selected.city || "—"}</div>
              <div><Phone size={14} className="inline mr-1"/><b>Teléfono:</b> {selected.phone || form.telefono || "—"}</div>
              <div><b>Tipo:</b> {(selected.business_types || []).join(", ") || "—"}</div>
            </div>
            {selectedContacts.length > 0 && <div className="pt-2 border-t">
              <div className="text-xs uppercase text-[#8A929A] mb-1">Contactos registrados</div>
              {selectedContacts.slice(0, 3).map((c: any) => <div key={c.id} className="text-xs text-[#5B6670] py-1">
                <UserRound size={12} className="inline mr-1"/><b>{c.name}</b>{c.position ? ` · ${c.position}` : ""} {c.phone ? ` · ${c.phone}` : ""} {c.email ? <><Mail size={12} className="inline ml-2 mr-1"/>{c.email}</> : null}
              </div>)}
            </div>}
          </div>}
        </> : <>
          <input value={form.nombre} onChange={e => patch({ nombre: e.target.value })} placeholder="Nombre del negocio / razón social *" className={`${input} w-full`} />
          <div className="flex flex-wrap">{TIPOS.map(t => <button key={t} onClick={() => patch({ tipos: toggle(form.tipos, t) })} className={`px-3 py-1.5 rounded-full text-xs border mr-1.5 mb-1.5 ${form.tipos.includes(t) ? "bg-[#1B3A6B] text-white" : "bg-white text-[#5B6670]"}`}>{t}</button>)}</div>
        </>}
      </div>}

      {step === 1 && <div className="grid grid-cols-2 gap-2">
        <input placeholder="Nombre del contacto" value={form.contactoNombre} onChange={e => patch({ contactoNombre: e.target.value })} className={input}/>
        <input placeholder="Cargo" value={form.contactoCargo} onChange={e => patch({ contactoCargo: e.target.value })} className={input}/>
        <input placeholder="Teléfono principal" value={form.telefono} onChange={e => patch({ telefono: e.target.value })} className={input}/>
        <input placeholder="WhatsApp" value={form.whatsapp} onChange={e => patch({ whatsapp: e.target.value })} className={input}/>
        <input placeholder="Correo" value={form.email} onChange={e => patch({ email: e.target.value })} className={`${input} col-span-2`}/>
      </div>}

      {step === 2 && <div className="space-y-3">
        <button onClick={gps} className="w-full py-3 rounded-xl border border-dashed text-sm"><MapPin size={16} className="inline mr-2"/>{coords ? `GPS: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "Capturar ubicación GPS"}</button>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Dirección" value={form.direccion} onChange={e => patch({ direccion: e.target.value })} className={input}/>
          <input placeholder="Zona" value={form.zona} onChange={e => patch({ zona: e.target.value })} className={input}/>
          <input placeholder="Ciudad" value={form.ciudad} onChange={e => patch({ ciudad: e.target.value })} className={`${input} col-span-2`}/>
        </div>
        {fotoPreview ? <div className="border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-3">
            <img src={fotoPreview} alt="Fotografía de la visita" className="w-20 h-20 rounded-lg object-cover border shrink-0"/>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-[#0F2647] font-medium truncate">{foto?.name}</div>
              <div className="text-xs text-[#3E7A56]"><Check size={12} className="inline mr-1"/>Foto lista, se guardará con la visita.</div>
            </div>
            <button type="button" onClick={() => setFoto(null)} title="Quitar foto" className="p-2 rounded-lg border text-red-600 shrink-0"><X size={16}/></button>
          </div>
          <label className="flex items-center justify-center py-2 border border-dashed rounded-xl cursor-pointer text-xs text-[#5B6670]"><Camera size={15} className="mr-1"/>Reemplazar fotografía<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setFoto(e.target.files?.[0] || null)}/></label>
        </div> : <label className="flex flex-col items-center py-5 border border-dashed rounded-xl cursor-pointer text-sm text-[#5B6670]"><Camera size={20}/>Tomar o subir fotografía<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setFoto(e.target.files?.[0] || null)}/></label>}
      </div>}

      {step === 3 && <div>
        <div className="flex justify-between mb-3"><b className="text-sm">Productos que consume</b><button onClick={addProd} className="text-sm text-[#1B3A6B]">+ Agregar</button></div>
        {form.productos.map((p, i) => <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2 p-2 border rounded-xl">
          <input placeholder="Producto" value={p.descripcion} onChange={e => { const a = [...form.productos]; a[i] = { ...a[i], descripcion: e.target.value }; patch({ productos: a }); }} className="col-span-2 border rounded-lg p-2 text-sm"/>
          <input placeholder="Marca" value={p.marca} onChange={e => { const a = [...form.productos]; a[i] = { ...a[i], marca: e.target.value }; patch({ productos: a }); }} className="border rounded-lg p-2 text-sm"/>
          <input type="number" placeholder="Volumen" value={p.cantidad} onChange={e => { const a = [...form.productos]; a[i] = { ...a[i], cantidad: e.target.value }; patch({ productos: a }); }} className="border rounded-lg p-2 text-sm"/>
          <select value={p.frecuencia} onChange={e => { const a = [...form.productos]; a[i] = { ...a[i], frecuencia: e.target.value }; patch({ productos: a }); }} className="border rounded-lg p-2 text-sm"><option>Diario</option><option>Semanal</option><option>Quincenal</option><option>Mensual</option><option>Ocasional</option></select>
          <button onClick={() => patch({ productos: form.productos.filter((_, x) => x !== i) })} className="col-span-2 sm:col-span-5 text-left text-xs text-red-600">Quitar</button>
        </div>)}
        {!form.productos.length && <div className="text-sm italic text-[#5B6670]">Sin productos agregados.</div>}
      </div>}

      {step === 4 && <div>
        <input placeholder="Proveedor actual" value={form.proveedor} onChange={e => patch({ proveedor: e.target.value })} className={`${input} w-full mb-3`}/>
        <div className="text-xs mb-2">¿Por qué compra ahí?</div>
        <div className="flex flex-wrap">{RAZONES.map(r => <button key={r} onClick={() => patch({ razones: toggle(form.razones, r) })} className={`px-3 py-1.5 rounded-full text-xs border mr-1.5 mb-1.5 ${form.razones.includes(r) ? "bg-[#1B3A6B] text-white" : "bg-white"}`}>{r}</button>)}</div>
      </div>}

      {step === 5 && <div className="space-y-3">
        <label className="flex gap-2 items-center"><input type="checkbox" checked={form.oportunidad} onChange={e => patch({ oportunidad: e.target.checked })}/> Detecté una oportunidad comercial</label>
        {form.oportunidad && <>
          <textarea placeholder="Descripción de la oportunidad / necesidad *" value={form.necesidad} onChange={e => patch({ necesidad: e.target.value })} className={`${input} w-full h-24`}/>
          <input type="number" placeholder="Monto estimado Bs" value={form.monto} onChange={e => patch({ monto: e.target.value })} className={`${input} w-full`}/>
          <div className="flex gap-2">{(["Bajo", "Medio", "Alto"] as const).map(x => <button key={x} onClick={() => patch({ interes: x })} className={`flex-1 py-2 rounded-xl border ${form.interes === x ? "bg-[#1B3A6B] text-white" : "bg-white"}`}>{x}</button>)}</div>
          <div className="border rounded-xl p-3">
            <div className="text-xs mb-2">Próxima acción / seguimiento (opcional)</div>
            <div className="grid grid-cols-2 gap-2"><select value={form.accion} onChange={e => patch({ accion: e.target.value })} className="border rounded-lg p-2 text-sm"><option>Llamar</option><option>Visitar</option><option>WhatsApp</option><option>Enviar cotización</option><option>Hacer seguimiento a la cotización</option></select><input type="date" value={form.fecha} onChange={e => patch({ fecha: e.target.value })} className="border rounded-lg p-2 text-sm"/></div>
            <input placeholder="Nota del seguimiento" value={form.nota} onChange={e => patch({ nota: e.target.value })} className="w-full border rounded-lg p-2 text-sm mt-2"/>
          </div>
        </>}
      </div>}

      {step === 6 && <div className="space-y-2">
        <div className="text-sm text-[#5B6670] mb-2">Puedes seleccionar uno o varios resultados de la visita.</div>
        {RESULTADOS.map(x => <button key={x} onClick={() => patch({ resultados: toggle(form.resultados, x) })} className={`w-full text-left px-3 py-2 rounded-xl border text-sm ${form.resultados.includes(x) ? "bg-[#1B3A6B] text-white" : "bg-white"}`}><span className="inline-block w-5">{form.resultados.includes(x) ? "✓" : ""}</span>{x}</button>)}
      </div>}

      <div className="flex justify-between mt-6">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={!step} className="flex items-center gap-1 text-sm disabled:opacity-40"><ChevronLeft size={16}/>Atrás</button>
        {step < STEPS.length - 1
          ? <button onClick={() => setStep(s => s + 1)} className="px-5 py-2.5 rounded-full bg-[#1B3A6B] text-white text-sm">Siguiente <ChevronRight size={16} className="inline"/></button>
          : <button onClick={save} disabled={guardando} className="px-5 py-2.5 rounded-full bg-[#1B3A6B] text-white text-sm disabled:opacity-50"><Check size={16} className="inline mr-1"/>{guardando ? "Guardando..." : "Guardar visita"}</button>}
      </div>
    </div>
  </Layout>;
}
