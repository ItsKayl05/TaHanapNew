import MyRentals from "./pages/TenantDashboard/MyRentals/MyRentals";
import MapPage from "./pages/MapPage/MapPage";
// frontend/src/App.jsx
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import AuthProvider from "./context/AuthContext";
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

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

const AppContent = () => {
    return (
        <div>
            {/* ✅ Navbar is always visible */}
            <Navbar />

            <ErrorBoundary>
              <Routes>
                <Route
                    path="/my-rental"
                    element={
                        <ProtectedRoute allowedRole="tenant">
                            <MyRentals />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/favorites"
                    element={
                        <ProtectedRoute allowedRole="tenant">
                            <Favorites />
                        </ProtectedRoute>
                    }
                />
                <Route path="/" element={<HomePage />} />
                <Route path="/properties" element={<PropertyListingPage />} /> {/* ✅ Added Route */}
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
                            <TenantDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/landlord-profile"
                    element={
                        <ProtectedRoute allowedRole="landlord">
                            <LandLordDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/add-properties"
                    element={
                        <ProtectedRoute allowedRole="landlord">
                            <AddProperties />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/my-properties"
                    element={
                        <ProtectedRoute allowedRole="landlord">
                            <MyProperties />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/edit-property/:propertyId"
                    element={
                        <ProtectedRoute allowedRole="landlord">
                            <EditProperty />
                        </ProtectedRoute>
                    }
                />
                <Route path="/property/:propertyId" element={<ViewProperty />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/rental-requests/:propertyId" element={
                    <ProtectedRoute allowedRole="landlord">
                        <RentalRequests />
                    </ProtectedRoute>
                } />
                    <Route path="/property-map" element={<PropertyMap />} />

                                <Route
                                    path="/tenant/messages"
                                    element={
                                        <ProtectedRoute allowedRole="tenant">
                                            <TenantMessages currentUserId={localStorage.getItem('user_id') || 'tenant-demo'} />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/landlord/messages"
                                    element={
                                        <ProtectedRoute allowedRole="landlord">
                                            <LandlordMessages currentUserId={localStorage.getItem('user_id') || 'landlord-demo'} />
                                        </ProtectedRoute>
                                    }
                                />
                        </Routes>
            </ErrorBoundary>

            <Footer />
            <ToastContainer />
        </div>
    );
};

function App() {
    return (
        <AuthProvider> {/* ✅ Wrap entire app with AuthProvider */}
            <SocketProvider>
              <Router>
                  <AppContent />
              </Router>
            </SocketProvider>
        </AuthProvider>
    );
}

export default App;
