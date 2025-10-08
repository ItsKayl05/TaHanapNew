import MyRentals from "./pages/TenantDashboard/MyRentals/MyRentals";
import MapPage from "./pages/MapPage/MapPage";
// frontend/src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import AuthProvider from "./context/AuthContext"; // Import AuthProvider
import { SocketProvider } from './context/SocketContext';

// Pages
import HomePage from "./pages/HomePage/HomePage";
import PropertyMap from "./pages/PropertyMap"; // Added import for PropertyMap
import PropertyDetailPage from "./pages/PropertyDetailPage/PropertyDetailPage";
import PropertyListingPage from "./pages/PropertyListingPage/PropertyListingPage"; // ✅ Added import
import LoginPage from "./pages/LoginPage/LoginPage";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import VerifyOTP from "./pages/VerifyEmail/VerifyOTP";
import AboutUs from "./pages/AboutUs/AboutUs";
import TermsOfService from './pages/Legal/TermsOfService';
import PrivacyPolicy from './pages/Legal/PrivacyPolicy';
import ContactUs from './pages/Legal/ContactUs';
import LandlordPublicProfile from './pages/LandlordPublicProfile/LandlordPublicProfile';
import TenantMessages from './pages/TenantDashboard/Messages/Messages';
import LandlordMessages from './pages/LandLordDashboard/Messages/Messages';

// Landlord Dashboard Pages
import LandLordDashboard from "./pages/LandLordDashboard/Dashboard/LandLordDashboard";
import AddProperties from "./pages/LandLordDashboard/AddProperties/AddProperties";
import MyProperties from "./pages/LandLordDashboard/MyProperties/MyProperties";
import EditProperty from "./pages/LandLordDashboard/MyProperties/EditProperty/EditProperty";
import RentalRequests from "./pages/LandLordDashboard/RentalRequests/RentalRequests";
import ViewProperty from "./pages/LandLordDashboard/MyProperties/ViewProperty/ViewProperty";

// Tenant Dashboard
import TenantDashboard from "./pages/TenantDashboard/Dashboard/TenantDashboard";
import Favorites from "./pages/TenantDashboard/Favorites/Favorites";

// Components
import Navbar from "./components/Navbar/Navbar";
import Footer from "./components/Footer/Footer";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

// Notifications
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Helper component to handle sidebar state
const AppContentWithSidebar = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Check if current route is a dashboard route
  const isDashboardRoute = location.pathname.includes('-profile') || 
                          location.pathname.includes('/my-') ||
                          location.pathname.includes('/add-') ||
                          location.pathname.includes('/edit-') ||
                          location.pathname.includes('/tenant/') ||
                          location.pathname.includes('/landlord/') ||
                          location.pathname.includes('/favorites') ||
                          location.pathname.includes('/my-rental');

  return (
    <div className={`app-container ${isDashboardRoute ? 'dashboard-layout' : ''}`}>
      {/* Show Navbar only on non-dashboard pages */}
      {!isDashboardRoute && <Navbar />}

      <main className={`main-content ${isDashboardRoute ? 'with-sidebar' : ''} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Routes>
          <Route
            path="/my-rental"
            element={
              <ProtectedRoute allowedRole="tenant">
                <MyRentals sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute allowedRole="tenant">
                <Favorites sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<HomePage />} />
          <Route path="/properties" element={<PropertyListingPage />} />
          <Route path="/property/:id" element={<PropertyDetailPage />} />
          <Route path="/landlord/:id" element={<LandlordPublicProfile />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/contact" element={<ContactUs />} />

          {/* ✅ Protected Routes with Role-Based Access */}
          <Route
            path="/tenant-profile"
            element={
              <ProtectedRoute allowedRole="tenant">
                <TenantDashboard sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord-profile"
            element={
              <ProtectedRoute allowedRole="landlord">
                <LandLordDashboard sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-properties"
            element={
              <ProtectedRoute allowedRole="landlord">
                <AddProperties sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-properties"
            element={
              <ProtectedRoute allowedRole="landlord">
                <MyProperties sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit-property/:propertyId"
            element={
              <ProtectedRoute allowedRole="landlord">
                <EditProperty sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/property/:propertyId" 
            element={
              <ProtectedRoute allowedRole="landlord">
                <ViewProperty sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            } 
          />
          <Route path="/map" element={<MapPage />} />
          <Route 
            path="/rental-requests/:propertyId" 
            element={
              <ProtectedRoute allowedRole="landlord">
                <RentalRequests sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
              </ProtectedRoute>
            } 
          />
          <Route path="/property-map" element={<PropertyMap />} />

          <Route
            path="/tenant/messages"
            element={
              <ProtectedRoute allowedRole="tenant">
                <TenantMessages 
                  currentUserId={localStorage.getItem('user_id') || 'tenant-demo'} 
                  sidebarOpen={sidebarOpen} 
                  setSidebarOpen={setSidebarOpen}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/messages"
            element={
              <ProtectedRoute allowedRole="landlord">
                <LandlordMessages 
                  currentUserId={localStorage.getItem('user_id') || 'landlord-demo'} 
                  sidebarOpen={sidebarOpen} 
                  setSidebarOpen={setSidebarOpen}
                />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {/* Show Footer only on non-dashboard pages */}
      {!isDashboardRoute && <Footer />}
      
      <ToastContainer />
    </div>
  );
};

const AppContent = () => {
  return (
    <Router>
      <AppContentWithSidebar />
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;