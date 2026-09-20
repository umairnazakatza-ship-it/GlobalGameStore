export type RegionCode = "pk" | "us" | "sa" | "ae" | "kw" | "global";

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
}

export interface Region {
  id: string;
  code: RegionCode;
  name: string;
  countries: string[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  region_id: string | null;
  featured: boolean;
  active: boolean;
  sold_out?: boolean;
  pre_loaded_account?: string;
  category?: { name: string } | null;
  region?: { code: RegionCode; name: string } | null;
}

export interface Variant {
  id: string;
  product_id: string;
  name: string;
  price: number;
  original_price: number | null;
  active: boolean;
  sold_out?: boolean;
  price_on_request?: boolean;
  stock?: number;
  region?: { code: RegionCode; name: string } | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  variant_id: string | null;
  variant_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  codes?: { code: string }[];
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_whatsapp: string | null;
  country: string | null;
  total: number;
  payment_method: "credits" | "whatsapp";
  status: "pending" | "paid" | "completed" | "cancelled";
  whatsapp_link: string | null;
  created_at: string;
  items?: OrderItem[];
  delivered_codes?: { code: string; product_name: string; variant_name: string }[];
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  role: "user" | "admin" | "sub_admin";
  credits_balance: number;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  admin_id: string | null;
  amount: number;
  reason: string | null;
  order_id: string | null;
  created_at: string;
}

export interface CartItem {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  productImage: string | null;
  variantName: string;
  unitPrice: number;
  quantity: number;
  stock?: number;
}
