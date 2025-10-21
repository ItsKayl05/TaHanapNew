import React from "react";
import "./DashboardCard.css";

const DashboardCard = ({ title, value, icon }) => {
  return (
    <div className="dashboard-card">
      <div className="card-icon">{icon}</div>
      <div className="card-info">
        <h3>{title}</h3>
        <p>{value}</p>
      </div>
    </div>
  );
};

export default DashboardCard;
