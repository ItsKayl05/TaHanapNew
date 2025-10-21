import Report from '../models/Report.js';
import User from '../models/User.js';
import Property from '../models/Property.js';
import Message from '../models/Message.js';

// Basic utility to ensure target relationship integrity
function validateTarget({ type, targetUser, targetProperty, targetMessage }) {
  if (type === 'user' && !targetUser) throw new Error('targetUser required');
  if (type === 'property' && !targetProperty) throw new Error('targetProperty required');
  if (type === 'message' && !targetMessage) throw new Error('targetMessage required');
}

export const createReport = async (req, res) => {
  try {
    const { type, targetUser, targetProperty, targetMessage, category, description } = req.body;
      if(!type || !category || !description) return res.status(400).json({ message:'Missing required fields'});
      if(typeof description !== 'string' || description.trim().length < 5) return res.status(400).json({ message:'Description too short'});
      // Basic validation by type
      if(type==='user' && !targetUser) return res.status(400).json({ message:'targetUser required'});
      if(type==='property' && !targetProperty) return res.status(400).json({ message:'targetProperty required'});
      if(type==='message' && !targetMessage) return res.status(400).json({ message:'targetMessage required'});

      // Prevent self-reporting (user reports themselves)
      if(type==='user' && targetUser && String(targetUser) === String(req.user.id)) {
        return res.status(400).json({ message:'You cannot report yourself.'});
      }

      // Prevent duplicate OPEN / UNDER_REVIEW reports by same reporter on same target
      const duplicateQuery = { reporter: req.user.id, type, status: { $in:['open','under_review'] } };
      if(type==='user') duplicateQuery.targetUser = targetUser;
      if(type==='property') duplicateQuery.targetProperty = targetProperty;
      if(type==='message') duplicateQuery.targetMessage = targetMessage;
      const existing = await Report.findOne(duplicateQuery).lean();
      if(existing) return res.status(409).json({ message:'You already have an active report for this target.'});

    const report = await Report.create({
      reporter: req.user.id,
      type,
      targetUser: targetUser || undefined,
      targetProperty: targetProperty || undefined,
      targetMessage: targetMessage || undefined,
      category,
        description: description.trim()
    });
      res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const listReports = async (req, res) => {
  try {
    const { status, type, category, q, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (q) filter.description = { $regex: q, $options: 'i' };
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Report.find(filter)
        .populate('reporter', 'username email role')
        .populate('targetUser', 'username email role')
        .populate('targetProperty', 'title price')
        .populate('targetMessage', 'content sender receiver')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Report.countDocuments(filter)
    ]);
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reporter', 'username email role')
      .populate('targetUser', 'username email role')
      .populate('targetProperty', 'title price')
      .populate('targetMessage', 'content sender receiver');
    if (!report) return res.status(404).json({ message: 'Not found' });
    res.json(report);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const addAdminNote = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Not found' });
    report.adminNotes.push({ note: req.body.note, admin: req.user.id });
    await report.save();
    res.json({ message: 'Note added', report });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body; // open, under_review, resolved, dismissed
    const report = await Report.findById(req.params.id);
    if(!report) return res.status(404).json({ message: 'Not found' });
    // Prevent changing status once resolved (must use resolve endpoint)
    if(report.status === 'resolved' && status !== 'resolved') {
      return res.status(400).json({ message:'Cannot change status after resolution' });
    }
    report.status = status;
    await report.save();
    if (!report) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Status updated', report });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const resolveReport = async (req, res) => {
  try {
    const { action = 'none', details = '' } = req.body;
    const allowed = ['none','warned','temporary_ban','permanent_ban','content_removed','other'];
    if(!allowed.includes(action)) return res.status(400).json({ message:'Invalid action'});

    const report = await Report.findById(req.params.id).populate('targetUser').populate('targetProperty').populate('targetMessage');
    if (!report) return res.status(404).json({ message: 'Not found' });

    // Idempotency: if already resolved do not double apply destructive actions
    if(report.status === 'resolved') {
      return res.json({ message:'Already resolved', report });
    }

    const sideEffects = { performed: [], errors: [] };

    // Helper: persist target user after modification
    const saveTargetUser = async(u)=> { try { await u.save(); } catch(e){ sideEffects.errors.push('userSave:'+e.message); }};

    if(action === 'warned' && report.targetUser) {
      // Simple warning: append system note
      report.adminNotes.push({ note: `System: user ${report.targetUser.username} warned. ${details||''}`.trim(), admin: req.user.id });
      sideEffects.performed.push('warned_user');
    }
    if(action === 'temporary_ban' && report.targetUser) {
      // Implement temporary ban via status=banned + attach ban metadata in resolution details if not provided
      report.targetUser.status = 'banned';
      // We store ban expiry inside resolution.details (lightweight approach). 7 days default.
      const expiresAt = new Date(Date.now() + 7*24*60*60*1000);
      const banLine = `Temporary ban applied until ${expiresAt.toISOString()}`;
      if(!details.includes('Temporary ban')) report.resolution = { ...report.resolution, details: (details? details+' \n' : '') + banLine };
      await saveTargetUser(report.targetUser);
      sideEffects.performed.push('temporary_ban_7d');
    }
    if(action === 'permanent_ban' && report.targetUser) {
      report.targetUser.status = 'banned';
      // Increment tokenVersion to invalidate existing auth tokens if your auth system checks this
      report.targetUser.tokenVersion = (report.targetUser.tokenVersion||0)+1;
      await saveTargetUser(report.targetUser);
      sideEffects.performed.push('permanent_ban');
    }
    if(action === 'content_removed') {
      if(report.type === 'property' && report.targetProperty) {
        // Soft removal: mark archived
        try { await Property.findByIdAndUpdate(report.targetProperty._id, { status:'archived' }); sideEffects.performed.push('property_archived'); } catch(e){ sideEffects.errors.push('property:'+e.message); }
      }
      if(report.type === 'message' && report.targetMessage) {
        try { await Message.findByIdAndUpdate(report.targetMessage._id, { content:'[removed by moderation]' }); sideEffects.performed.push('message_content_cleared'); } catch(e){ sideEffects.errors.push('message:'+e.message); }
      }
    }

    // Generic note for 'other'
    if(action === 'other' && details) {
      report.adminNotes.push({ note: `System note: ${details}`, admin: req.user.id });
      sideEffects.performed.push('other_note_logged');
    }

    report.status = 'resolved';
    report.resolution = { action, details: details, resolvedBy: req.user.id, resolvedAt: new Date() };

    await report.save();

    res.json({ message: 'Report resolved', report, sideEffects });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const deleteReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
