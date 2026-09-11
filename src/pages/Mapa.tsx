import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Layout } from "../components/Layout";
import { supabase } from "../lib/supabase";

// Ícono por defecto de Leaflet (si no se configura, los pines no se ven)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function Mapa() {
  const navigate = useNavigate();
  const [puntos, setPuntos] = useState<any[]>([]);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    // Última visita con coordenadas por cliente
    const { data } = await supabase
      .from("visits")
      .select("customer_id, latitude, longitude, customers(name)")
      .not("latitude", "is", null)
      .order("visit_date", { ascending: false });

    const porCliente = new Map<string, any>();
    (data ?? []).forEach((v: any) => {
      if (!porCliente.has(v.customer_id)) porCliente.set(v.customer_id, v);
    });
    setPuntos(Array.from(porCliente.values()));
  }

  const centro: [number, number] = puntos.length
    ? [puntos[0].latitude, puntos[0].longitude]
    : [-17.7833, -63.1821]; // Santa Cruz de la Sierra

  return (
    <Layout title="Mapa comercial">
      <div className="bg-white rounded-2xl p-2 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06)" }}>
        <MapContainer center={centro} zoom={12} style={{ height: "500px", width: "100%", borderRadius: "12px" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {puntos.map((p) => (
            <Marker key={p.customer_id} position={[p.latitude, p.longitude]} icon={icon}>
              <Popup>
                <button onClick={() => navigate(`/clientes/${p.customer_id}`)} className="text-sm font-medium text-[#1B3A6B]">
                  {p.customers?.name}
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {puntos.length === 0 && (
        <p className="text-sm italic text-[#5B6670] mt-3">
          Todavía no hay visitas con GPS capturado. En cuanto registres una "Nueva visita" con ubicación, aparecerá aquí.
        </p>
      )}
    </Layout>
  );
}
