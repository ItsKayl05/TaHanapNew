import MapPage from './pages/MapPage/MapPage';
import TenantMessages from './pages/TenantDashboard/Messages/Messages';
import LandlordMessages from './pages/LandLordDashboard/Messages/Messages';
import MyRentals from './pages/TenantDashboard/MyRentals/MyRentals';
import RentalRequests from './pages/LandLordDashboard/RentalRequests/RentalRequests';
// ...existing code...
export const routes = [
  // ...existing routes...
  {
    path: '/map',
    element: <MapPage />, 
  },
  {
    path: '/tenant/messages',
    element: <TenantMessages currentUserId={localStorage.getItem('user_id') || 'tenant-demo'} />,
  },
  {
    path: '/my-rental',
    element: <MyRentals />,
  },
  {
    path: '/rental-requests/:propertyId',
    element: <RentalRequests />,
  },
  {
    path: '/landlord/messages',
    element: <LandlordMessages currentUserId={localStorage.getItem('user_id') || 'landlord-demo'} />,
  },
];
// ...existing code...
