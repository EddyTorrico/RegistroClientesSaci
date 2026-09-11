import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else navigate("/dashboard");
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0F2647 0%, #1B3A6B 55%, #5B6670 100%)" }}
    >
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl mb-4 shadow-lg bg-white text-[#1B3A6B]">
            SP
          </div>
          <div className="text-white text-2xl font-semibold tracking-tight">SACIPETROL S.R.L.</div>
          <div className="text-[#C9D6E8] text-sm mt-1">Bienvenido a tu plataforma comercial</div>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-3xl shadow-xl p-7">
          <div className="text-sm font-medium mb-4 text-[#0F2647]">Inicia sesión</div>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="space-y-3 mb-5">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="Correo electrónico"
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
              style={{ borderColor: "#DDE1E6" }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              placeholder="Contraseña"
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
              style={{ borderColor: "#DDE1E6" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-medium bg-[#1B3A6B] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
