import { Routes, Route, Navigate } from "react-router-dom";
import { Login } from "../pages/Login";
import { Dashboard } from "../pages/Dashboard";
import { Clientes } from "../pages/Clientes";
import { ClienteDetail } from "../pages/ClienteDetail";
import { NuevaVisita } from "../pages/NuevaVisita";
import { Oportunidades } from "../pages/Oportunidades";
import { Seguimientos } from "../pages/Seguimientos";
import { Mapa } from "../pages/Mapa";
import { AdminUsuarios } from "../pages/AdminUsuarios";
import { Cotizaciones } from "../pages/Cotizaciones";
import { Productos } from "../pages/Productos";
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
      <Route path="/productos" element={<ProtectedRoute><Productos /></ProtectedRoute>} />
      <Route path="/cotizaciones" element={<ProtectedRoute><Cotizaciones /></ProtectedRoute>} />
      <Route path="/mapa" element={<ProtectedRoute><Mapa /></ProtectedRoute>} />
      <Route path="/admin/usuarios" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsuarios /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
