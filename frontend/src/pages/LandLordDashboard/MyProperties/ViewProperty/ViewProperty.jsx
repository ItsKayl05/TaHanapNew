import React from "react";
import { useNavigate } from "react-router-dom";
import "./ViewProperty.css";

const ViewProperty = ({ property }) => {
    const navigate = useNavigate();

    return (
        <div className="property-card" onClick={() => navigate(`/property/${property._id}`)}>
            <div className="property-card-image">
                <img src={property.images[0] || '/default-property.jpg'} alt="Property" />
            </div>
            <div className="property-card-body">
                <h3 className="property-title">{property.title}</h3>
                <p className="property-category">{property.category}</p>
                <p className="property-location">{property.barangay}</p>
                <p className="property-price">₱{property.price.toLocaleString()}</p>
                <button className="property-btn">View More</button>
            </div>
        </div>
    );
};

export default ViewProperty;
