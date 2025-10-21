import React from "react";
import "./PropertyTable.css";

const PropertyTable = ({ properties = [], loading=false, onDelete }) => {
  return (
    <div className="property-table">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Barangay</th>
            <th>Listing Type</th>
            <th>Price (₱)</th>
            <th>Rooms</th>
            <th>Size (sqm)</th>
            <th>Video</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            [...Array(5)].map((_,i)=>(
              <tr key={i} className="skeleton-row">
                <td colSpan={9}><div className="skeleton-line"/></td>
              </tr>
            ))
          ) : properties.length ? (
            properties.map((p) => (
              <tr key={p._id}>
                <td className="truncate" title={p.title}>{p.title}</td>
                <td>{p.barangay || '-'}</td>
                <td>{p.propertyType || '-'}</td>
                <td>{p.price?.toLocaleString?.() || 0}</td>
                <td>{p.numberOfRooms || 0}</td>
                <td>{p.areaSqm || 0}</td>
                <td>{p.video ? 'Yes' : 'No'}</td>
                <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</td>
                <td className="actions-cell">
                  <button className="delete-btn" onClick={()=>onDelete && onDelete(p._id)}>Delete</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} style={{textAlign:'center', padding:'1rem'}}>No properties found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PropertyTable;
