import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import PropertyTable from "../../components/PropertyTable/PropertyTable";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import adminService from "../../services/AdminService";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./ManageProperties.css";

const ManageProperties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [confirmingProp, setConfirmingProp] = useState(null); // property object queued for deletion

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await adminService.getProperties();
        setProperties(data);
      } catch (err) {
        toast.error("Failed to load properties");
      } finally { setLoading(false); }
    };
    load();
  }, [refreshFlag]);

  const filtered = useMemo(()=>{
    const term = search.toLowerCase().trim();
    return properties.filter(p=> term ? (p.title?.toLowerCase().includes(term) || p.barangay?.toLowerCase().includes(term) || p.category?.toLowerCase().includes(term)) : true);
  },[properties, search]);

  const sorted = useMemo(()=>{
    return [...filtered].sort((a,b)=>{
      switch(sort){
        case 'priceAsc': return (a.price||0)-(b.price||0);
        case 'priceDesc': return (b.price||0)-(a.price||0);
        case 'roomsDesc': return (b.numberOfRooms||0)-(a.numberOfRooms||0);
        case 'roomsAsc': return (a.numberOfRooms||0)-(b.numberOfRooms||0);
        case 'areaDesc': return (b.areaSqm||0)-(a.areaSqm||0);
        case 'areaAsc': return (a.areaSqm||0)-(b.areaSqm||0);
        case 'oldest': return new Date(a.createdAt||0)-new Date(b.createdAt||0);
        case 'newest': default: return new Date(b.createdAt||0)-new Date(a.createdAt||0);
      }
    });
  },[filtered, sort]);

  const handleDelete = (id) => {
    const prop = properties.find(p=>p._id===id);
    setConfirmingProp(prop || { _id:id });
  };
  const cancelDelete = () => setConfirmingProp(null);

  return (
    <div className="manage-properties-container">
      <Sidebar /> {/* ✅ Added Sidebar */}
      <div className="manage-properties">
        <div className="mp-header-row">
          <h2>Manage Properties</h2>
          <div className="mp-actions">
            <input
              className="mp-search"
              placeholder="Search title, barangay, category..."
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
            <select className="mp-sort" value={sort} onChange={e=>setSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priceDesc">Price High-Low</option>
              <option value="priceAsc">Price Low-High</option>
              <option value="roomsDesc">Rooms High-Low</option>
              <option value="roomsAsc">Rooms Low-High</option>
              <option value="areaDesc">Area High-Low</option>
              <option value="areaAsc">Area Low-High</option>
            </select>
            <button className="mp-refresh" onClick={()=>setRefreshFlag(f=>f+1)}>Refresh</button>
          </div>
        </div>
  <PropertyTable loading={loading} properties={sorted} onDelete={handleDelete} />
  <ConfirmDialog
    open={!!confirmingProp}
    title={confirmingProp ? `Delete Property${confirmingProp.title?': '+confirmingProp.title:''}` : 'Delete Property'}
    message={confirmingProp?.title ? `The property "${confirmingProp.title}" will be permanently removed. This action cannot be undone.` : 'This property will be permanently removed. This action cannot be undone.'}
    confirmLabel="Delete"
    cancelLabel="Cancel"
    danger
    autoFocus="cancel"
    icon={<span role="img" aria-label="Delete">🗑️</span>}
    onConfirm={async ()=>{
      if(!confirmingProp) return;
      const id = confirmingProp._id;
      // Optimistic removal
      setProperties(prev=> prev.filter(p=>p._id !== id));
      const title = confirmingProp.title || 'Property';
      const deletionPromise = adminService.deleteProperty(id);
      toast.promise(deletionPromise, {
        pending: `Deleting ${title}...`,
        success: `${title} deleted`,
        error: {
          render({ data }) {
            return data?.response?.data?.error || 'Delete failed';
          }
        }
      });
      try {
        await deletionPromise;
      } catch (e) {
        // On failure refetch list to restore item
        setRefreshFlag(f=>f+1);
      } finally {
        setConfirmingProp(null);
      }
    }}
    onCancel={cancelDelete}
  />
      </div>
    </div>
  );
};

export default ManageProperties;
