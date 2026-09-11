import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { supabase, supabaseAdminAuth } from "../lib/supabase";
import { UserRole, Profile } from "../types";

export function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("vendedor");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    setUsuarios((data ?? []) as Profile[]);
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setGuardando(true);

    // Se usa un cliente secundario (supabaseAdminAuth) para que, al crear el nuevo
    // usuario, la sesión del Admin que está usando la app no se cierre.
    const { data, error } = await supabaseAdminAuth.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });

    if (error) {
      setMensaje(`Error: ${error.message}`);
      setGuardando(false);
      return;
    }

    if (data.user) {
      // El trigger de la base de datos ya crea el perfil; aquí solo confirmamos el rol elegido.
      await supabase.from("profiles").update({ role, full_name: fullName }).eq("id", data.user.id);
      setMensaje("Usuario creado correctamente.");
      setFullName("");
      setEmail("");
      setPassword("");
      cargar();
    }
    setGuardando(false);
  }

  return (
    <Layout title="Usuarios" subtitle="Crea y gestiona las cuentas de tu equipo">
      <div className="grid grid-cols-2 gap-6 max-w-3xl">
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06)" }}>
          <div className="text-sm font-semibold mb-3 text-[#0F2647]">Registrar nuevo usuario</div>
          {mensaje && <p className="text-sm mb-3 text-[#5B6670]">{mensaje}</p>}
          <form onSubmit={crearUsuario} className="space-y-2.5">
            <input required placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: "#DDD8C8" }} />
            <input required type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: "#DDD8C8" }} />
            <input required type="password" placeholder="Contraseña inicial" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: "#DDD8C8" }} />
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: "#DDD8C8" }}>
              <option value="vendedor">Vendedor</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Administrador</option>
            </select>
            <button disabled={guardando} type="submit" className="w-full py-2.5 rounded-xl text-white text-sm font-medium bg-[#1B3A6B] disabled:opacity-60">
              {guardando ? "Creando..." : "Crear usuario"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 1px 2px rgba(15,38,71,0.06)" }}>
          <div className="text-sm font-semibold mb-3 text-[#0F2647]">Usuarios registrados</div>
          <div className="space-y-2">
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F5F6F8]">
                <span className="text-sm text-[#0F2647]">{u.full_name}</span>
                <span className="text-xs capitalize text-[#5B6670]">{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
