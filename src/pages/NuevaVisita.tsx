import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { MapPin, Camera, Check, ChevronLeft, ChevronRight } from "lucide-react";

const STEPS = ["Cliente", "Negocio", "Contacto", "Ubicación", "Productos", "Proveedor", "Oportunidad", "Resultado"];
const TIPOS_NEGOCIO = ["Ferretería", "Tienda eléctrica", "Distribuidor", "Constructor", "Contratista", "Electricista", "Industria", "Institución", "Otro"];
const RAZONES_PROVEEDOR = ["Precio", "Crédito", "Disponibilidad", "Marca", "Rapidez", "Cercanía", "Calidad", "Servicio"];
const RESULTADOS = [
  "Solo levantamiento de información", "Cliente interesado", "Solicita cotización", "Solicita catálogo",
  "Solicita visita técnica", "Compra inmediata", "Requiere seguimiento", "No interesado", "No se encontró al responsable",
];

const inputClass = "border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/20";
function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs border mr-1.5 mb-1.5 ${selected ? "bg-[#1B3A6B] text-white border-[#1B3A6B]" : "bg-white text-[#5B6670] border-[#DDD8C8]"}`}
    >
      {children}
    </button>
  );
}

export function NuevaVisita() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [form, setForm] = useState({
    nombreNegocio: "",
    tiposNegocio: [] as string[],
    contactoNombre: "", contactoCargo: "", contactoCelular: "", contactoWhatsapp: "", contactoEmail: "", decideCompras: "sí" as "sí" | "no" | "parcialmente",
    direccion: "", zona: "", ciudad: "Santa Cruz de la Sierra",
    productos: [] as { descripcion: string; frecuencia: string; marca: string }[],
    proveedorNombre: "", proveedorMotivos: [] as string[],
    necesidadDescripcion: "", montoEstimado: "", interes: "Medio" as "Bajo" | "Medio" | "Alto",
    resultado: "", proximaAccionTipo: "Llamar", proximaAccionFecha: "", proximaAccionNota: "",
  });

  function patch(fields: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...fields }));
  }

  function capturarGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("No se pudo obtener la ubicación GPS. Puedes continuar sin ella.")
    );
  }

  function agregarProducto() {
    patch({ productos: [...form.productos, { descripcion: "", frecuencia: "Semanal", marca: "" }] });
  }
  function actualizarProducto(i: number, campo: string, valor: string) {
    const copia = [...form.productos];
    (copia[i] as any)[campo] = valor;
    patch({ productos: copia });
  }
  function quitarProducto(i: number) {
    patch({ productos: form.productos.filter((_, idx) => idx !== i) });
  }

  async function guardar() {
    if (!profile) return;
    setGuardando(true);
    setError("");
    try {
      const { data: cliente, error: errCliente } = await supabase
        .from("customers")
        .insert({
          name: form.nombreNegocio,
          business_types: form.tiposNegocio,
          zone: form.zona,
          city: form.ciudad,
          created_by: profile.id,
        })
        .select()
        .single();
      if (errCliente) throw errCliente;

      if (form.contactoNombre) {
        await supabase.from("customer_contacts").insert({
          customer_id: cliente.id,
          name: form.contactoNombre,
          position: form.contactoCargo,
          phone: form.contactoCelular,
          whatsapp: form.contactoWhatsapp,
          email: form.contactoEmail,
          is_decision_maker: form.decideCompras,
        });
      }

      let photoUrl: string | null = null;
      if (foto) {
        const path = `${cliente.id}/${Date.now()}-${foto.name}`;
        const { error: errUpload } = await supabase.storage.from("visit-photos").upload(path, foto);
        if (!errUpload) {
          const { data: pub } = supabase.storage.from("visit-photos").getPublicUrl(path);
          photoUrl = pub.publicUrl;
        }
      }

      const { error: errVisita } = await supabase.from("visits").insert({
        customer_id: cliente.id,
        user_id: profile.id,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        address: form.direccion,
        zone: form.zona,
        photo_url: photoUrl,
        provider_name: form.proveedorNombre,
        provider_reasons: form.proveedorMotivos,
        need_description: form.necesidadDescripcion,
        estimated_amount: form.montoEstimado ? Number(form.montoEstimado) : null,
        interest_level: form.interes,
        result: form.resultado,
        next_action_type: form.resultado === "Requiere seguimiento" ? form.proximaAccionTipo : null,
        next_action_date: form.resultado === "Requiere seguimiento" ? form.proximaAccionFecha : null,
        next_action_note: form.resultado === "Requiere seguimiento" ? form.proximaAccionNota : null,
      });
      if (errVisita) throw errVisita;

      for (const p of form.productos) {
        if (!p.descripcion) continue;
        await supabase.from("customer_products").insert({
          customer_id: cliente.id,
          description: p.descripcion,
          frequency: p.frecuencia,
          usual_brand: p.marca,
        });
      }

      if (form.montoEstimado) {
        await supabase.from("opportunities").insert({
          customer_id: cliente.id,
          user_id: profile.id,
          title: form.necesidadDescripcion || "Oportunidad detectada en visita",
          valor_estimado: Number(form.montoEstimado),
          probabilidad: 30,
          estado: "detectada",
        });
      }

      if (form.resultado === "Requiere seguimiento" && form.proximaAccionFecha) {
        await supabase.from("follow_ups").insert({
          customer_id: cliente.id,
          user_id: profile.id,
          type: form.proximaAccionTipo,
          scheduled_date: form.proximaAccionFecha,
          notes: form.proximaAccionNota,
          completed: false,
        });
      }

      navigate(`/clientes/${cliente.id}`);
    } catch (e: any) {
      setError(e.message ?? "Ocurrió un error al guardar la visita.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Layout title="Nueva visita" subtitle={`Paso ${step + 1} de ${STEPS.length}: ${STEPS[step]}`}>
      <div className="max-w-xl">
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        {step === 0 && (
          <div>
            <div className="text-sm font-semibold mb-3 text-[#0F2647]">Datos del negocio</div>
            <label className="flex flex-col gap-1.5 mb-3">
              <span className="text-xs text-[#8A857A]">Nombre del negocio *</span>
              <input value={form.nombreNegocio} onChange={(e) => patch({ nombreNegocio: e.target.value })} className={inputClass} style={{ borderColor: "#DDD8C8" }} />
            </label>
            <div className="text-xs text-[#8A857A] mb-1.5">Tipo de negocio</div>
            <div className="flex flex-wrap">
              {TIPOS_NEGOCIO.map((t) => (
                <Chip key={t} selected={form.tiposNegocio.includes(t)} onClick={() => patch({ tiposNegocio: form.tiposNegocio.includes(t) ? form.tiposNegocio.filter((x) => x !== t) : [...form.tiposNegocio, t] })}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="text-sm font-semibold mb-3 text-[#0F2647]">Contacto principal</div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Nombre" value={form.contactoNombre} onChange={(e) => patch({ contactoNombre: e.target.value })} className={inputClass} style={{ borderColor: "#DDD8C8" }} />
              <input placeholder="Cargo" value={form.contactoCargo} onChange={(e) => patch({ contactoCargo: e.target.value })} className={inputClass} style={{ borderColor: "#DDD8C8" }} />
              <input placeholder="Celular" value={form.contactoCelular} onChange={(e) => patch({ contactoCelular: e.target.value })} className={inputClass} style={{ borderColor: "#DDD8C8" }} />
              <input placeholder="WhatsApp" value={form.contactoWhatsapp} onChange={(e) => patch({ contactoWhatsapp: e.target.value })} className={inputClass} style={{ borderColor: "#DDD8C8" }} />
              <input placeholder="Correo" value={form.contactoEmail} onChange={(e) => patch({ contactoEmail: e.target.value })} className={`${inputClass} col-span-2`} style={{ borderColor: "#DDD8C8" }} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-sm font-semibold mb-3 text-[#0F2647]">Ubicación y foto</div>
            <button onClick={capturarGPS} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed mb-3 text-sm text-[#5B6670]" style={{ borderColor: "#B9B3A0" }}>
              <MapPin size={16} /> {coords ? "Ubicación capturada ✓" : "Capturar ubicación GPS"}
            </button>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input placeholder="Dirección" value={form.direccion} onChange={(e) => patch({ direccion: e.target.value })} className={inputClass} style={{ borderColor: "#DDD8C8" }} />
              <input placeholder="Zona" value={form.zona} onChange={(e) => patch({ zona: e.target.value })} className={inputClass} style={{ borderColor: "#DDD8C8" }} />
            </div>
            <label className="w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border border-dashed text-sm text-[#5B6670] cursor-pointer" style={{ borderColor: "#B9B3A0" }}>
              <Camera size={20} />
              {foto ? foto.name : "Tomar o subir fotografía"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-[#0F2647]">Productos que consume</div>
              <button onClick={agregarProducto} className="text-sm text-[#1B3A6B] font-medium">+ Agregar</button>
            </div>
            <div className="space-y-2">
              {form.productos.map((p, i) => (
                <div key={i} className="grid grid-cols-4 gap-1.5 bg-white p-2.5 rounded-xl border" style={{ borderColor: "#DDD8C8" }}>
                  <input placeholder="Producto" value={p.descripcion} onChange={(e) => actualizarProducto(i, "descripcion", e.target.value)} className="col-span-2 border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: "#DDD8C8" }} />
                  <select value={p.frecuencia} onChange={(e) => actualizarProducto(i, "frecuencia", e.target.value)} className="border rounded-lg px-1.5 py-1.5 text-sm" style={{ borderColor: "#DDD8C8" }}>
                    {["Diario", "Semanal", "Quincenal", "Mensual", "Ocasional"].map((f) => <option key={f}>{f}</option>)}
                  </select>
                  <input placeholder="Marca" value={p.marca} onChange={(e) => actualizarProducto(i, "marca", e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: "#DDD8C8" }} />
                  <button onClick={() => quitarProducto(i)} className="col-span-4 text-xs text-red-600 text-left">Quitar</button>
                </div>
              ))}
              {form.productos.length === 0 && <div className="text-xs italic text-[#5B6670]">Agrega los productos que este cliente consume.</div>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="text-sm font-semibold mb-3 text-[#0F2647]">Proveedor actual</div>
            <input placeholder="Nombre del proveedor" value={form.proveedorNombre} onChange={(e) => patch({ proveedorNombre: e.target.value })} className={`${inputClass} w-full mb-3`} style={{ borderColor: "#DDD8C8" }} />
            <div className="text-xs text-[#8A857A] mb-1.5">¿Por qué compra ahí?</div>
            <div className="flex flex-wrap">
              {RAZONES_PROVEEDOR.map((r) => (
                <Chip key={r} selected={form.proveedorMotivos.includes(r)} onClick={() => patch({ proveedorMotivos: form.proveedorMotivos.includes(r) ? form.proveedorMotivos.filter((x) => x !== r) : [...form.proveedorMotivos, r] })}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <div className="text-sm font-semibold mb-3 text-[#0F2647]">Oportunidad comercial</div>
            <textarea placeholder="Describa la necesidad" value={form.necesidadDescripcion} onChange={(e) => patch({ necesidadDescripcion: e.target.value })} className={`${inputClass} w-full h-20 resize-none mb-3`} style={{ borderColor: "#DDD8C8" }} />
            <input placeholder="Monto estimado (Bs, opcional)" value={form.montoEstimado} onChange={(e) => patch({ montoEstimado: e.target.value })} className={`${inputClass} w-full mb-3`} style={{ borderColor: "#DDD8C8" }} />
            <div className="text-xs text-[#8A857A] mb-1.5">Nivel de interés</div>
            <div className="flex gap-2">
              {(["Bajo", "Medio", "Alto"] as const).map((op) => (
                <button key={op} onClick={() => patch({ interes: op })} className={`flex-1 py-2 rounded-xl text-sm border ${form.interes === op ? "border-[#1B3A6B] bg-[#EEF0F6]" : "border-[#DDD8C8] bg-white"}`}>
                  {op}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <div className="text-sm font-semibold mb-3 text-[#0F2647]">Resultado de la visita</div>
            <div className="space-y-1.5 mb-4">
              {RESULTADOS.map((op) => (
                <button key={op} onClick={() => patch({ resultado: op })} className={`w-full text-left px-3 py-2 rounded-xl text-sm border ${form.resultado === op ? "border-[#1B3A6B] bg-[#EEF0F6]" : "border-[#DDD8C8] bg-white"}`}>
                  {op}
                </button>
              ))}
            </div>
            {form.resultado === "Requiere seguimiento" && (
              <div className="bg-white border rounded-xl p-3" style={{ borderColor: "#DDD8C8" }}>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select value={form.proximaAccionTipo} onChange={(e) => patch({ proximaAccionTipo: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" style={{ borderColor: "#DDD8C8" }}>
                    {["Llamar", "Visitar", "WhatsApp", "Enviar cotización"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input type="date" value={form.proximaAccionFecha} onChange={(e) => patch({ proximaAccionFecha: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" style={{ borderColor: "#DDD8C8" }} />
                </div>
                <input placeholder="Nota" value={form.proximaAccionNota} onChange={(e) => patch({ proximaAccionNota: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-sm" style={{ borderColor: "#DDD8C8" }} />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="flex items-center gap-1 text-sm text-[#5B6670] disabled:opacity-40">
            <ChevronLeft size={16} /> Atrás
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#1B3A6B] px-5 py-2.5 rounded-full">
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={guardar} disabled={guardando || !form.nombreNegocio} className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#1B3A6B] px-5 py-2.5 rounded-full disabled:opacity-60">
              <Check size={16} /> {guardando ? "Guardando..." : "Guardar visita"}
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
