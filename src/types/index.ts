export type UserRole = "admin" | "gerente" | "vendedor";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  active: boolean;
  created_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  business_types: string[] | null;
  zone: string | null;
  city: string | null;
  created_by: string | null;
  created_at?: string;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  position: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  is_decision_maker: "sí" | "no" | "parcialmente" | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  sku: string;
  name: string;
  unit: string | null;
  active: boolean;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  price_type: "minorista" | "mayorista" | "distribuidor" | "especial";
  price: number;
  currency: string;
  active: boolean;
}

export interface Visit {
  id: string;
  customer_id: string;
  user_id: string;
  visit_date: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  zone: string | null;
  photo_url: string | null;
  provider_name: string | null;
  provider_reasons: string[] | null;
  needs: string[] | null;
  need_description: string | null;
  purchase_timing: string | null;
  estimated_amount: number | null;
  interest_level: "Bajo" | "Medio" | "Alto" | null;
  result: string | null;
  next_action_type: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
}

export interface VisitProduct {
  id: string;
  visit_id: string;
  product_id: string | null;
  description: string;
  frequency: string | null;
  volume: string | null;
  brand: string | null;
}

export interface Opportunity {
  id: string;
  customer_id: string;
  user_id: string;
  title: string;
  valor_estimado: number | null;
  probabilidad: number | null;
  estado: "detectada" | "en_negociacion" | "ganada" | "perdida";
  created_at?: string;
}

export interface FollowUp {
  id: string;
  customer_id: string;
  user_id: string;
  type: string;
  scheduled_date: string;
  completed: boolean;
  notes: string | null;
}
