import Application from '../models/Application.js';
import Property from '../models/Property.js';
import User from '../models/User.js';

// Tenant creates an application (status Pending)
export const createApplication = async (req, res) => {
  try {
    const tenantId = req.user.id;
    const { propertyId, message } = req.body;
    if (!propertyId) return res.status(400).json({ error: 'propertyId required' });

    const property = await Property.findById(propertyId).populate('landlord');
    if (!property) return res.status(404).json({ error: 'Property not found' });
    // Block applications if approved applications already meet or exceed totalUnits
    const approvedCount = await Application.countDocuments({ property: propertyId, status: 'Approved' });
    if ((property.totalUnits || 1) <= approvedCount) {
      return res.status(400).json({ error: 'Property is fully occupied and cannot accept new applications' });
    }

    // Prevent duplicate pending applications by same tenant for same property
    const existing = await Application.findOne({ property: propertyId, tenant: tenantId, status: 'Pending' });
    if (existing) return res.status(409).json({ error: 'You already have a pending application for this property' });

    const app = new Application({
      property: propertyId,
      tenant: tenantId,
      landlord: property.landlord._id,
      message: message || ''
    });
    await app.save();
    res.status(201).json({ message: 'Application submitted', application: app });
  } catch (e) {
    console.error('createApplication error', e);
    res.status(500).json({ error: e.message });
  }
};

// Tenant: list own applications grouped by status or filterable
export const getApplicationsByTenant = async (req, res) => {
  try {
    const tenantId = req.user.id;
    const apps = await Application.find({ tenant: tenantId }).populate('property').populate('landlord', 'fullName profilePic contactNumber');
    res.json(apps);
  } catch (e) {
    console.error('getApplicationsByTenant error', e);
    res.status(500).json({ error: e.message });
  }
};

// Landlord: list applications for a property
export const getApplicationsByProperty = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const userId = req.user.id;
    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    if (property.landlord.toString() !== userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    const apps = await Application.find({ property: propertyId }).populate('tenant', 'fullName email profilePic contactNumber').sort({ createdAt: -1 });
    res.json({ propertyId, applications: apps });
  } catch (e) {
    console.error('getApplicationsByProperty error', e);
    res.status(500).json({ error: e.message });
  }
};

// Landlord approves an application -> status Approved
export const approveApplication = async (req, res) => {
  try {
    const appId = req.params.id;
    const userId = req.user.id;
    const app = await Application.findById(appId).populate('property');
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.landlord.toString() !== userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    // Determine if approving this application would exceed totalUnits
    const approvedBefore = await Application.countDocuments({ property: app.property._id, status: 'Approved' });
    if ((app.property.totalUnits || 1) <= approvedBefore) {
      return res.status(409).json({ error: 'No available units remaining for this property' });
    }

    // After successful approval, update property's availabilityStatus if necessary
    let updatedProperty = null;

    app.status = 'Approved';
    app.actedAt = new Date();
    await app.save();

    // re-fetch property to reflect any status change
    updatedProperty = await Property.findById(app.property._id);
    // If approved applications now meet/exceed totalUnits, mark Fully Occupied
    const approvedAfter = await Application.countDocuments({ property: app.property._id, status: 'Approved' });
    if ((updatedProperty.totalUnits || 1) <= approvedAfter) {
      updatedProperty.availabilityStatus = 'Fully Occupied';
      await updatedProperty.save();
    }

    res.json({ message: 'Application approved', application: app, property: updatedProperty });
  } catch (e) {
    console.error('approveApplication error', e);
    res.status(500).json({ error: e.message });
  }
};

// Landlord rejects an application -> status Rejected
export const rejectApplication = async (req, res) => {
  try {
    const appId = req.params.id;
    const userId = req.user.id;
    const app = await Application.findById(appId).populate('property');
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.landlord.toString() !== userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    app.status = 'Rejected';
    app.actedAt = new Date();
    await app.save();
    res.json({ message: 'Application rejected', application: app });
  } catch (e) {
    console.error('rejectApplication error', e);
    res.status(500).json({ error: e.message });
  }
};
