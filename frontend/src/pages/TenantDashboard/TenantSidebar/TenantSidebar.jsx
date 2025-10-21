import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardSidebar from '../../../components/DashboardSidebar/DashboardSidebar';

const TenantSidebar = ({ handleLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;
    const links = [
        { key:'profile', label:'Profile', to:'/tenant-profile', active: path.includes('tenant-profile') },
        { key:'properties', label:'All Listings', to:'/properties', active: path === '/properties' },
        { key:'favorites', label:'Favorites', to:'/favorites', active: path === '/favorites' },
        { key:'map', label:'Map', to:'/map', active: path === '/map' },
        { key:'messages', label:'Messages', to:'/tenant/messages', active: path === '/tenant/messages' },
        { key:'my-rental', label:'My Rental', to:'/my-rental', active: path === '/my-rental' },
    ];
    return (
        <DashboardSidebar
            variant="tenant"
            links={links}
            onNavigate={(to)=>navigate(to)}
            onLogout={handleLogout}
        />
    );
};

export default TenantSidebar;