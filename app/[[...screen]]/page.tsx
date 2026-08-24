import type { ComponentType } from "react";
import { notFound } from "next/navigation";

import CustomersScreen from "../_screens/CustomersScreen";
import DashboardScreen from "../_screens/DashboardScreen";
import EmployeesScreen from "../_screens/EmployeesScreen";
import HistoryScreen from "../_screens/HistoryScreen";
import InventoryScreen from "../_screens/InventoryScreen";
import LoginScreen from "../_screens/LoginScreen";
import NotificationsScreen from "../_screens/NotificationsScreen";
import PosScreen from "../_screens/PosScreen";
import ProductsScreen from "../_screens/ProductsScreen";
import RecommendationsScreen from "../_screens/RecommendationsScreen";
import SettingsScreen from "../_screens/SettingsScreen";

const routeScreens: Record<string, ComponentType> = {
  customers: CustomersScreen,
  employees: EmployeesScreen,
  history: HistoryScreen,
  inventory: InventoryScreen,
  login: LoginScreen,
  notifications: NotificationsScreen,
  pos: PosScreen,
  products: ProductsScreen,
  recommendations: RecommendationsScreen,
  settings: SettingsScreen,
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
