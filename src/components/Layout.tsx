import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, Users, MapPin, Target, CalendarClock, BarChart3, Settings,
  Plus, LogOut, Package, UserCog, FileText, ShoppingBag,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/mapa", label: "Mapa", icon: MapPin },
  { to: "/oportunidades", label: "Oportunidades", icon: Target },
  { to: "/seguimientos", label: "Seguimientos", icon: CalendarClock },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/cotizaciones", label: "Cotizaciones", icon: FileText },
  { to: "/ventas", label: "Ventas", icon: ShoppingBag }, // Fase 7: módulo Ventas
];

export function Layout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen w-full flex" style={{ backgroundColor: "#F5F6F8" }}>
      <aside className="w-60 shrink-0 text-white flex flex-col print:hidden" style={{ backgroundColor: "#0F2647" }}>
        <div className="px-5 py-6 border-b border-white/10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm bg-[#1B3A6B] text-white">
            SP
          </div>
          <div>
            <div className="font-semibold tracking-tight text-sm">SACIPETROL</div>
            <div className="text-[10px] text-[#8CA0BC]">Plataforma comercial</div>
          </div>
        </div>
        <nav className="flex-1 py-4">
          <button
            onClick={() => navigate("/visitas/nueva")}
            className="w-full flex items-center gap-2 mx-4 mb-4 px-3 py-2.5 rounded-xl text-sm font-medium text-white bg-[#1B3A6B]"
          >
            <Plus size={16} /> Nueva visita
          </button>
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 ${
                    isActive ? "border-[#6E9CD6] bg-white/5 text-white" : "border-transparent text-[#9FB1C8] hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <Icon size={16} strokeWidth={1.75} />
                {n.label}
              </NavLink>
            );
          })}
          {profile?.role === "admin" && (
            <NavLink
              to="/admin/usuarios"
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 ${
                  isActive ? "border-[#6E9CD6] bg-white/5 text-white" : "border-transparent text-[#9FB1C8] hover:text-white hover:bg-white/5"
                }`
              }
            >
              <UserCog size={16} strokeWidth={1.75} /> Usuarios
            </NavLink>
          )}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#9FB1C8]">
            <Settings size={14} /> {profile?.full_name ?? "..."}
          </div>
          <button onClick={handleLogout} className="text-[#9FB1C8] hover:text-white">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-4 border-b bg-white print:hidden" style={{ borderColor: "#E2E5EA" }}>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#0F2647]">{title}</h1>
            {subtitle && <p className="text-sm text-[#5B6670]">{subtitle}</p>}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-8 py-6 print:p-0">{children}</div>
      </main>
    </div>
  );
}
