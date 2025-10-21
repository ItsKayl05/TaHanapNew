import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import UserTable from "../../components/UserTable/UserTable";
import adminService from "../../services/AdminService";
import { useAuth } from "../../context/AdminAuthContext";
import { toast, ToastContainer } from "react-toastify";
import { useRef, useCallback } from "react";
import "./ManageUsers.css";

const ManageUsers = () => {
  const [confirmModal, setConfirmModal] = useState({ open: false, userId: null, userType: null });
  const pendingDeleteRef = useRef(null);
  const [tenants, setTenants] = useState([]);
  const [landlords, setLandlords] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [filteredLandlords, setFilteredLandlords] = useState([]);
  const [searchInput, setSearchInput] = useState(""); // immediate input
  const [search, setSearch] = useState(""); // debounced value used for filtering
  const [statusFilter, setStatusFilter] = useState("all");
  const [nameSort, setNameSort] = useState("none"); // none | asc | desc
  const [statusSort, setStatusSort] = useState("none"); // none | asc | desc
  const [tenantPage, setTenantPage] = useState(1);
  const [landlordPage, setLandlordPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState(null);
  const { token, logout, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

  const fetchUsers = async () => {
      try {
    const users = await adminService.getUsers();
    if (!users) throw new Error('No data returned');

        if (!Array.isArray(users)) {
          throw new Error('Invalid data format');
        }

  const t = users.filter(user => user.role === 'tenant');
  const l = users.filter(user => user.role === 'landlord');
  setTenants(t);
  setLandlords(l);
  setFilteredTenants(t);
  setFilteredLandlords(l);
        setError(null);
      } catch (error) {
        const status = error.response?.status;
        console.error('ManageUsers fetch error status=', status, 'data=', error.response?.data, 'message=', error.message);
        if (status === 401) {
          setError('Session expired. Please login again.');
          logout();
        } else if (status === 403) {
          setError('Access denied (403). Your account may not be admin.');
        } else {
          setError(error.response?.data?.message || 'Failed to load users.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [token, logout]);

  // Debounce search input
  useEffect(()=>{
    const id = setTimeout(()=> setSearch(searchInput.trim()), 350);
    return ()=> clearTimeout(id);
  }, [searchInput]);

  // Derived filter/sort
  useEffect(()=>{
    const apply = (list) => {
      let out = [...list];
      if (search.trim()) {
        const q = search.toLowerCase();
        out = out.filter(u => (u.fullName || u.username || '').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
      }
      if (statusFilter !== 'all') {
        out = out.filter(u => u.status === statusFilter);
      }
      if (nameSort !== 'none') {
        out.sort((a,b)=>{
          const A = (a.fullName || a.username || '').toLowerCase();
          const B = (b.fullName || b.username || '').toLowerCase();
            if (A < B) return nameSort === 'asc' ? -1 : 1;
            if (A > B) return nameSort === 'asc' ? 1 : -1;
            return 0;
        });
      }
      if (statusSort !== 'none') {
        out.sort((a,b)=>{
          const order = a.status.localeCompare(b.status);
          return statusSort === 'asc' ? order : -order;
        });
      }
      return out;
    };
    setFilteredTenants(apply(tenants));
    setFilteredLandlords(apply(landlords));
  }, [search, statusFilter, nameSort, statusSort, tenants, landlords]);

  const toggleNameSort = () => {
    setNameSort(s => s === 'none' ? 'asc' : s === 'asc' ? 'desc' : 'none');
  };

  const toggleStatusSort = () => {
    setStatusSort(s => s === 'none' ? 'asc' : s === 'asc' ? 'desc' : 'none');
  };

  // Adjust pages when filters change
  useEffect(()=>{
    setTenantPage(1);
    setLandlordPage(1);
  }, [search, statusFilter, nameSort, statusSort, pageSize]);

  // Pagination slices
  const paginate = (list, page) => {
    const start = (page-1)*pageSize;
    return list.slice(start, start + pageSize);
  };
  const tenantTotalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const landlordTotalPages = Math.max(1, Math.ceil(filteredLandlords.length / pageSize));
  const paginatedTenants = paginate(filteredTenants, Math.min(tenantPage, tenantTotalPages));
  const paginatedLandlords = paginate(filteredLandlords, Math.min(landlordPage, landlordTotalPages));


  const handleDelete = (userId, userType) => {
    setConfirmModal({ open: true, userId, userType });
  };

  const confirmDelete = useCallback(async () => {
    const { userId, userType } = confirmModal;
    if (!userId) return;
    try {
      await adminService.deleteUser(userId, token);
      if (userType === 'tenant') {
        setTenants(tenants.filter(u => u._id !== userId));
      } else {
        setLandlords(landlords.filter(u => u._id !== userId));
      }
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user');
      toast.error('Failed to delete user');
    } finally {
      setConfirmModal({ open: false, userId: null, userType: null });
    }
  }, [confirmModal, token, tenants, landlords]);

  if (authLoading) {
    return <div>Loading authentication...</div>;
  }

  if (loading) {
    return <div>Loading users...</div>;
  }

  return (
    <div className={`manage-users-container ${sidebarOpen ? 'sidebar-visible' : ''}`}>
      <div className="mu-mobile-bar">
        <button className="mu-menu-btn" onClick={()=>setSidebarOpen(o=>!o)}>{sidebarOpen ? '✕' : '☰'}</button>
        <span className="mu-mobile-title">Manage Users</span>
      </div>
      <Sidebar />
      <div className="manage-users" onClick={()=> sidebarOpen && setSidebarOpen(false)}>
        <div className="mu-controls">
          <div className="mu-search-wrap">
            <input
              type="text"
              placeholder="Search name or email..."
              value={searchInput}
              onChange={e=>setSearchInput(e.target.value)}
            />
          </div>
          <div className="mu-filters">
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
            <button type="button" className="sort-btn" onClick={toggleNameSort}>Name {nameSort === 'none' ? '' : nameSort === 'asc' ? '↑' : '↓'}</button>
            <button type="button" className="sort-btn alt" onClick={toggleStatusSort}>Status {statusSort === 'none' ? '' : statusSort === 'asc' ? '↑' : '↓'}</button>
            <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))} className="page-size-select">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <h2>Manage Users</h2>
        {error && <div className="error-message">{error}</div>}

        <h3>Property Seekers ({filteredTenants.length})</h3>
        <UserTable
          users={paginatedTenants}
          onDelete={handleDelete}
          userType="tenant"
          loading={loading}
          userLabelPlural="Property Seekers"
        />
        <div className="pagination-bar">
          <button disabled={tenantPage===1} onClick={()=>setTenantPage(p=>Math.max(1,p-1))}>Prev</button>
          <span>Page {tenantPage} / {tenantTotalPages}</span>
          <button disabled={tenantPage===tenantTotalPages} onClick={()=>setTenantPage(p=>Math.min(tenantTotalPages,p+1))}>Next</button>
        </div>

        <h3>Property Owners ({filteredLandlords.length})</h3>
        <UserTable
          users={paginatedLandlords}
          onDelete={handleDelete}
          userType="landlord"
          loading={loading}
          userLabelPlural="Property Owners"
        />
        <div className="pagination-bar">
          <button disabled={landlordPage===1} onClick={()=>setLandlordPage(p=>Math.max(1,p-1))}>Prev</button>
          <span>Page {landlordPage} / {landlordTotalPages}</span>
          <button disabled={landlordPage===landlordTotalPages} onClick={()=>setLandlordPage(p=>Math.min(landlordTotalPages,p+1))}>Next</button>
        </div>
      </div>
      {/* Custom confirmation modal for delete */}
      {confirmModal.open && (
        <div className="mu-modal-overlay" style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(0,0,0,0.25)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="mu-modal" style={{background:'#fff',borderRadius:'12px',boxShadow:'0 2px 24px #0002',padding:'32px',maxWidth:'350px',width:'100%',textAlign:'center'}}>
            <h2 style={{marginBottom:'12px',color:'#d32f2f'}}>Delete User</h2>
            <p style={{marginBottom:'24px',fontSize:'1rem'}}>Are you sure you want to <b>delete</b> this user? <br/>This action <span style={{color:'#d32f2f',fontWeight:600}}>cannot be undone</span>.</p>
            <div style={{display:'flex',gap:'16px',justifyContent:'center'}}>
              <button className="ll-btn danger" style={{minWidth:'100px'}} onClick={confirmDelete}>Delete</button>
              <button className="ll-btn outline" style={{minWidth:'100px'}} onClick={()=>setConfirmModal({ open: false, userId: null, userType: null })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </div>
  );
};

export default ManageUsers;