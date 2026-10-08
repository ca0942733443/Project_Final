import type { ComponentType } from "react";
import { notFound } from "next/navigation";

import CustomersScreen from "../_screens/CustomersScreen";
import CustomerCreditDetailScreen from "../_screens/CustomerCreditDetailScreen";
import DashboardScreen from "../_screens/DashboardScreen";
import EmployeesScreen from "../_screens/EmployeesScreen";
import HistoryScreen from "../_screens/HistoryScreen";
import InventoryScreen from "../_screens/InventoryScreen";
import InventoryOrdersScreen from "../_screens/InventoryOrdersScreen";
import InventoryOrderCreateScreen from "../_screens/InventoryOrderCreateScreen";
import LoginScreen from "../_screens/LoginScreen";
import NotificationsScreen from "../_screens/NotificationsScreen";
import PosScreen from "../_screens/PosScreen";
import PurchaseOrderScreen from "../_screens/PurchaseOrderScreen";
import ProductsScreen from "../_screens/ProductsScreen";
import RecommendationsScreen from "../_screens/RecommendationsScreen";
import SettingsScreen from "../_screens/SettingsScreen";
import SuppliersScreen from "../_screens/SuppliersScreen"; // 🟢 Import หน้า SuppliersScreen
import StockScreen from "../_screens/StockScreen"; // 🟢 Import หน้า StockScreen
import CategoryScreen from "../_screens/CategoryScreen";
import ProductManageScreen from "../_screens/ProductManageScreen";
import AddProductScreen from "../_screens/AddProductScreen";

const routeScreens: Record<string, ComponentType> = {
  customers: CustomersScreen,
  "customer-credit": CustomerCreditDetailScreen,
  employees: EmployeesScreen,
  history: HistoryScreen,
  inventory: InventoryScreen,
  "inventory-orders": InventoryOrdersScreen,
  "inventory-order-create": InventoryOrderCreateScreen,
  login: LoginScreen,
  notifications: NotificationsScreen,
  pos: PosScreen,
  "purchase-order": PurchaseOrderScreen,
  products: ProductsScreen,
  recommendations: RecommendationsScreen,
  settings: SettingsScreen,
  suppliers: SuppliersScreen, // 🟢 เพิ่มแมปปิ้งสำหรับ URL /suppliers
  stock: StockScreen, // 🟢 เพิ่มแมปปิ้งสำหรับ URL /suppliers
  categories: CategoryScreen,
  productmanage: ProductManageScreen,
  addproduct: AddProductScreen
};

type ScreenRouteProps = {
  params: Promise<{ screen?: string[] }>;
};

export default async function ScreenRoute({ params }: ScreenRouteProps) {
  const { screen } = await params;

  if (!screen) {
    return <DashboardScreen />;
  }

  if (screen.length !== 1) {
    notFound();
  }

  const Screen = routeScreens[screen[0]];

  if (!Screen) {
    notFound();
  }

  return <Screen />;
}
