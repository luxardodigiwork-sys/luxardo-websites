import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { BackendPermissions } from "./types";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

import Layout from "./components/Layout";

import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import CollectionsPage from "./pages/CollectionsPage";
import CollectionDetailPage from "./pages/CollectionDetailPage";
import PrimePage from "./pages/PrimePage";
import PrimeMembershipCheckoutPage from "./pages/PrimeMembershipCheckoutPage";
import PrimeMembershipSuccessPage from "./pages/PrimeMembershipSuccessPage";
import PrimeMembershipFailedPage from "./pages/PrimeMembershipFailedPage";
import PrimeDashboardPage from "./pages/PrimeDashboardPage";
import MembershipTermsPage from "./pages/MembershipTermsPage";
import CraftsmanshipPage from "./pages/CraftsmanshipPage";
import OurStoryPage from "./pages/OurStoryPage";
import WholesalePage from "./pages/WholesalePage";
import ContactPage from "./pages/ContactPage";
import FAQPage from "./pages/FAQPage";
import ShippingPolicyPage from "./pages/ShippingPolicyPage";
import ReturnsPolicyPage from "./pages/ReturnsPolicyPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import TrackOrderPage from "./pages/TrackOrderPage";
import AccountPage from "./pages/AccountPage";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import LoginPage from "./pages/LoginPage";
import LoginErrorPage from "./pages/LoginErrorPage";
import ProductPage from "./pages/ProductPage";
import BespokeRequestPage from "./pages/BespokeRequestPage";
import StyleConsultationPage from "./pages/StyleConsultationPage";
import FabricLibraryPage from "./pages/FabricLibraryPage";

import { WishlistProvider } from "./context/WishlistContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

import RegisterPage from "./pages/RegisterPage";

// Admin imports
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminDispatchPage from "./pages/admin/AdminDispatchPage";
import AdminOrderDetailsPage from "./pages/admin/AdminOrderDetailsPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminCollectionsPage from "./pages/admin/AdminCollectionsPage";
import AdminAddProductPage from "./pages/admin/AdminAddProductPage";
import AdminEditProductPage from "./pages/admin/AdminEditProductPage";
import AdminContentPage from "./pages/admin/AdminContentPage";
import AdminMediaPage from "./pages/admin/AdminMediaPage";
import AdminPoliciesPage from "./pages/admin/AdminPoliciesPage";
import AdminPrimeContentPage from "./pages/admin/AdminPrimeContentPage";
import AdminBespokeRequestsPage from "./pages/admin/AdminBespokeRequestsPage";
import AdminPrimeMembersPage from "./pages/admin/AdminPrimeMembersPage";
import AdminBackendManagementPage from "./pages/admin/BackendManagementPage";
import AdminPartnersPage from "./pages/admin/AdminPartnersPage";
import AdminContactMessagesPage from "./pages/admin/AdminContactMessagesPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import DispatchDashboardPage from "./pages/dispatch/DispatchDashboardPage";
import BackendGatewayPage from "./pages/BackendGatewayPage";
import DispatchLayout from "./components/dispatch/DispatchLayout";

import AdminLayout from "./components/admin/AdminLayout";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";

import OwnerLayout from "./components/owner/OwnerLayout";
import OwnerDashboardPage from "./pages/owner/OwnerDashboardPage";
import AnalysisLayout from "./components/analysis/AnalysisLayout";
import AnalysisDashboardPage from "./pages/analysis/AnalysisDashboardPage";

const ProtectedBackendRoute = ({
  role,
  permission,
  children,
}: {
  role: string;
  permission?: keyof BackendPermissions;
  children: React.ReactNode;
}) => {
  const { user, isAuthReady } = useAuth();
  if (!isAuthReady)
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        Loading...
      </div>
    );

  const isSuperAdmin = user && ["super_admin", "admin"].includes(user.role);
  const hasRole = user && user.role === role;
  const hasPermission =
    !permission || (user?.permissions && user.permissions[permission]);

  if (!user || (!isSuperAdmin && (!hasRole || !hasPermission))) {
    return <Navigate to="/backend" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  // ... (Lenis initialization remains the same)
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    import('./utils/localStorage').then(({ initFirebaseStorage }) => {
      initFirebaseStorage().finally(() => {
        setIsInitializing(false);
      });
    });
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.5,
      infinite: false,
    });

    // Expose globally for scroll restoration
    (window as any).lenis = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    return () => {
      lenis.destroy();
      delete (window as any).lenis;
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col gap-6 items-center justify-center font-display uppercase tracking-widest text-sm text-brand-black">
        <div className="w-12 h-12 border-t-2 border-r-2 border-brand-black rounded-full animate-spin"></div>
        <p className="animate-pulse">Loading Luxardo...</p>
      </div>
    );
  }

  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <Routes>
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route path="/admin" element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route
                  index
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="dispatch" element={<AdminDispatchPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="collections" element={<AdminCollectionsPage />} />
                <Route path="products/new" element={<AdminAddProductPage />} />
                <Route
                  path="products/:id/edit"
                  element={<AdminEditProductPage />}
                />
                <Route path="content" element={<AdminContentPage />} />
                <Route path="media" element={<AdminMediaPage />} />
                <Route
                  path="prime-content"
                  element={<AdminPrimeContentPage />}
                />
                <Route path="policies" element={<AdminPoliciesPage />} />
                <Route
                  path="bespoke-requests"
                  element={<AdminBespokeRequestsPage />}
                />
                <Route
                  path="prime-members"
                  element={<AdminPrimeMembersPage />}
                />
                <Route path="partners" element={<AdminPartnersPage />} />
                <Route
                  path="contact-messages"
                  element={<AdminContactMessagesPage />}
                />
                <Route
                  path="backend-management"
                  element={<AdminBackendManagementPage />}
                />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>

            {/* Dispatch Portal Routes */}
            <Route
              path="/dispatch/login"
              element={<Navigate to="/backend" replace />}
            />
            <Route
              path="/dispatch"
              element={
                <ProtectedBackendRoute
                  role="dispatch"
                  permission="dispatch_actions"
                >
                  <DispatchLayout />
                </ProtectedBackendRoute>
              }
            >
              <Route
                index
                element={<Navigate to="/dispatch/dashboard" replace />}
              />
              <Route path="dashboard" element={<DispatchDashboardPage />} />
            </Route>

            {/* Backend Gateway & Other Portals */}
            <Route path="/backend" element={<BackendGatewayPage />} />
            <Route
              path="/analysis/login"
              element={<Navigate to="/backend" replace />}
            />
            <Route
              path="/owner/login"
              element={<Navigate to="/backend" replace />}
            />
            <Route
              path="/owner"
              element={
                <ProtectedBackendRoute
                  role="owner"
                  permission="backend_management"
                >
                  <OwnerLayout />
                </ProtectedBackendRoute>
              }
            >
              <Route
                index
                element={<Navigate to="/owner/dashboard" replace />}
              />
              <Route path="dashboard" element={<OwnerDashboardPage />} />
              <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
            </Route>
            <Route
              path="/analysis"
              element={
                <ProtectedBackendRoute
                  role="analysis"
                  permission="analysis_reports"
                >
                  <AnalysisLayout />
                </ProtectedBackendRoute>
              }
            >
              <Route
                index
                element={<Navigate to="/analysis/dashboard" replace />}
              />
              <Route path="dashboard" element={<AnalysisDashboardPage />} />
            </Route>

            {/* Public Routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              {/* ... other routes ... */}
              <Route path="collections" element={<CollectionsPage />} />
              <Route
                path="collections/:category"
                element={<CollectionDetailPage />}
              />
              <Route path="prime-membership" element={<PrimePage />} />
              <Route
                path="prime-dashboard"
                element={
                  <ProtectedRoute>
                    <PrimeDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/checkout"
                element={
                  <ProtectedRoute>
                    <PrimeMembershipCheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/success"
                element={
                  <ProtectedRoute>
                    <PrimeMembershipSuccessPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/failed"
                element={<PrimeMembershipFailedPage />}
              />
              <Route
                path="prime-membership/bespoke-request"
                element={
                  <ProtectedRoute>
                    <BespokeRequestPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/style-consultation"
                element={
                  <ProtectedRoute>
                    <StyleConsultationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/fabric-library"
                element={
                  <ProtectedRoute>
                    <FabricLibraryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="policies/membership-terms"
                element={<MembershipTermsPage />}
              />
              <Route
                path="private-client-services/*"
                element={<Navigate to="/prime-membership" replace />}
              />
              <Route path="craftsmanship" element={<CraftsmanshipPage />} />
              <Route path="our-story" element={<OurStoryPage />} />
              <Route path="wholesale" element={<WholesalePage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="faq" element={<FAQPage />} />
              <Route
                path="policies/shipping"
                element={<ShippingPolicyPage />}
              />
              <Route path="policies/returns" element={<ReturnsPolicyPage />} />
              <Route path="policies/privacy" element={<PrivacyPolicyPage />} />
              <Route path="policies/terms" element={<TermsPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route
                path="checkout"
                element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="order-confirmation"
                element={<OrderConfirmationPage />}
              />
              <Route path="track-order/:orderId" element={<TrackOrderPage />} />
              <Route
                path="account"
                element={
                  <ProtectedRoute>
                    <AccountPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="account/orders/:orderId"
                element={
                  <ProtectedRoute>
                    <OrderDetailsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="login" element={<LoginPage />} />
              <Route path="login-error" element={<LoginErrorPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="product/:id" element={<ProductPage />} />
            </Route>
          </Routes>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
