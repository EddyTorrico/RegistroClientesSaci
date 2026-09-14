import { Routes, Route, Navigate } from "react-router-dom";
import { Login } from "../pages/Login";
import { Dashboard } from "../pages/Dashboard";
import { Clientes } from "../pages/Clientes";
import { ClienteDetail } from "../pages/ClienteDetail";
import { NuevaVisita } from "../pages/NuevaVisita";
import { Oportunidades } from "../pages/Oportunidades";
import { Seguimientos } from "../pages/Seguimientos";
import { Catalogo } from "../pages/Catalogo";
import { Mapa } from "../pages/Mapa";
import { AdminUsuarios } from "../pages/AdminUsuarios";
import { Inventario } from "../pages/Inventario";
import { Cotizaciones } from "../pages/Cotizaciones";
import { ProtectedRoute } from "../components/ProtectedRoute";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
      <Route path="/clientes/:id" element={<ProtectedRoute><ClienteDetail /></ProtectedRoute>} />
      <Route path="/visitas/nueva" element={<ProtectedRoute><NuevaVisita /></ProtectedRoute>} />
      <Route path="/oportunidades" element={<ProtectedRoute><Oportunidades /></ProtectedRoute>} />
      <Route path="/seguimientos" element={<ProtectedRoute><Seguimientos /></ProtectedRoute>} />
      <Route path="/catalogo" element={<ProtectedRoute><Catalogo /></ProtectedRoute>} />
      <Route path="/inventario" element={<ProtectedRoute allowedRoles={["admin", "gerente"]}><Inventario /></ProtectedRoute>} />
      <Route path="/cotizaciones" element={<ProtectedRoute><Cotizaciones /></ProtectedRoute>} />
      <Route path="/mapa" element={<ProtectedRoute><Mapa /></ProtectedRoute>} />
      <Route path="/admin/usuarios" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsuarios /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
