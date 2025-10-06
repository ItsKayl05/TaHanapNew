// Get per-barangay user stats (landlords and tenants)
export const getUserBarangayStats = async (req, res) => {
    try {
        // Official barangay list (should match frontend)
        const barangayList = [
            'Assumption','Bagong Buhay I','Bagong Buhay II','Bagong Buhay III','Ciudad Real','Citrus','Dulong Bayan','Fatima I','Fatima II','Fatima III','Fatima IV','Fatima V','Francisco Homes – Guijo','Francisco Homes – Mulawin','Francisco Homes – Narra','Francisco Homes – Yakal','Gaya-gaya','Graceville','Gumaok Central','Gumaok East','Gumaok West','Kaybanban','Kaypian','Lawang Pare','Maharlika','Minuyan I','Minuyan II','Minuyan III','Minuyan IV','Minuyan V','Minuyan Proper','Muzon East','Muzon Proper','Muzon South','Muzon West','Paradise III','Poblacion','Poblacion 1','San Isidro','San Manuel','San Martin De Porres','San Martin I','San Martin II','San Martin III','San Martin IV','San Pedro','San Rafael I','San Rafael II','San Rafael III','San Rafael IV','San Rafael V','San Roque','Sapang Palay Proper','Sta. Cruz I','Sta. Cruz II','Sta. Cruz III','Sta. Cruz IV','Sta. Cruz V','Sto. Cristo','Sto. Nino I','Sto. Nino II','Tungkong Mangga'
        ];
        // Fetch all users with role landlord or tenant
        const users = await User.find({ role: { $in: ['landlord', 'tenant'] } }, 'role barangay');
        // Aggregate counts
        const stats = {};
        barangayList.forEach(b => { stats[b] = { landlords: 0, tenants: 0 }; });
        let unknown = { landlords: 0, tenants: 0 };
        users.forEach(u => {
            const brgy = barangayList.includes(u.barangay) ? u.barangay : 'Unknown';
            if (brgy === 'Unknown') {
                if (u.role === 'landlord') unknown.landlords++;
                if (u.role === 'tenant') unknown.tenants++;
            } else {
                if (u.role === 'landlord') stats[brgy].landlords++;
                if (u.role === 'tenant') stats[brgy].tenants++;
            }
        });
        // Convert to array for frontend
        const result = [
            ...barangayList.map(barangay => ({ barangay, ...stats[barangay] })),
            ...(unknown.landlords > 0 || unknown.tenants > 0 ? [{ barangay: 'Unknown', ...unknown }] : [])
        ];
        res.json({ barangayStats: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch barangay stats', error });
    }
};
import User from '../models/User.js';
import Property from '../models/Property.js'; // Assuming this is your property model

// Fetch admin dashboard stats
export const getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalProperties = await Property.countDocuments();
 

        res.json({
            totalUsers,
            totalProperties,
// ...existing code...
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch admin stats', error });
    }
};
