// Get all message threads for the current user
export const getMessageThreads = async (req, res) => {
	try {
		const myId = req.user.id;
		// Find all messages where the user is sender or receiver
		const messages = await Message.find({
			$or: [
				{ sender: myId },
				{ receiver: myId }
			]
		}).sort({ updatedAt: -1, createdAt: -1 });

		// Map to unique user IDs (other than self)
		const userMap = new Map();
		for (const msg of messages) {
			const otherId = String(msg.sender) === String(myId) ? String(msg.receiver) : String(msg.sender);
			if (!userMap.has(otherId)) {
				userMap.set(otherId, { lastMessage: msg.content, lastMessageAt: msg.createdAt, property: msg.property });
			}
		}
		const userIds = Array.from(userMap.keys());
		if (userIds.length === 0) return res.json([]);
		// Fetch user info
		const users = await User.find({ _id: { $in: userIds } }).select('_id fullName username profilePic');
		// Merge last message info
		const result = users.map(u => ({
			_id: u._id,
			fullName: u.fullName,
			username: u.username,
			// ensure profilePic is an absolute URL when possible (Cloudinary URLs kept as-is)
			profilePic: u.profilePic ? (u.profilePic.startsWith('http') ? u.profilePic : `${req.protocol}://${req.get('host')}/uploads/profiles/${u.profilePic}`) : '',
			lastMessage: userMap.get(String(u._id)).lastMessage,
			property: userMap.get(String(u._id)).property
		}));
		// Populate property info for threads
		const propertyIds = result.map(r => r.property).filter(Boolean);
		let propertyMap = {};
		if (propertyIds.length) {
			const props = await (await import('../models/Property.js')).default.find({ _id: { $in: propertyIds } }).select('_id title price images');
			// convert any relative image paths to absolute URLs so frontend can render them uniformly
			propertyMap = Object.fromEntries(props.map(p => {
				const po = p.toObject ? p.toObject() : p;
				po.images = (po.images || []).map(img => img && img.startsWith('http') ? img : `${req.protocol}://${req.get('host')}${img}`);
				return [String(p._id), po];
			}));
		}
		const resultWithProperty = result.map(r => r.property ? { ...r, propertyInfo: propertyMap[String(r.property)] } : r);
		res.json(resultWithProperty);
	} catch (err) {
		res.status(500).json({ message: 'Error fetching message threads', error: err.message });
	}
};
import Message from '../models/Message.js';
import User from '../models/User.js';
import { uploadBuffer, extractPublicId } from '../utils/cloudinary.js';
import cloudinary from '../utils/cloudinary.js';

// Send a message
export const sendMessage = async (req, res) => {
	try {
		const { receiver, content, property } = req.body;
		if (!receiver || !content) return res.status(400).json({ message: 'Receiver and content are required.' });
		const attachments = [];
		// If files were uploaded via memoryUploadInstance.array('attachments'), they will be in req.files
		if (req.files && req.files.length) {
			for (const f of req.files) {
				if (f && f.buffer) {
					try {
						const res = await uploadBuffer(f.buffer, { folder: 'tahanap/messages' });
						attachments.push({ url: res.secure_url, originalName: f.originalname, publicId: res.public_id });
					} catch (e) {
						console.error('Cloudinary upload failed for message attachment', e);
					}
				}
			}
		}

		const message = new Message({
			sender: req.user.id,
			receiver,
			content,
			property: property || undefined,
			attachments
		});
		await message.save();
		// Populate property images after saving
		let populatedMessage = await Message.findById(message._id).populate({ path: 'property', select: '_id title price images' });
		if (populatedMessage && populatedMessage.property && populatedMessage.property.images) {
			populatedMessage = populatedMessage.toObject ? populatedMessage.toObject() : populatedMessage;
			populatedMessage.property.images = (populatedMessage.property.images || []).map(img => img && img.startsWith('http') ? img : `${req.protocol}://${req.get('host')}${img}`);
		}
		res.status(201).json(populatedMessage);
	} catch (err) {
		res.status(500).json({ message: 'Error sending message', error: err.message });
	}
};

// Get chat history between two users
export const getMessages = async (req, res) => {
	try {
		const { userId } = req.params;
		const myId = req.user.id;
		let messages = await Message.find({
			$or: [
				{ sender: myId, receiver: userId },
				{ sender: userId, receiver: myId }
			]
		}).sort({ createdAt: 1 }).populate({ path: 'property', select: '_id title price images' });
		// normalize any property images to absolute URLs
		messages = messages.map(m => {
			const mo = m.toObject ? m.toObject() : m;
			if (mo.property && mo.property.images) {
				mo.property.images = (mo.property.images || []).map(img => img && img.startsWith('http') ? img : `${req.protocol}://${req.get('host')}${img}`);
			}
			return mo;
		});
		res.json(messages);
	} catch (err) {
		res.status(500).json({ message: 'Error fetching messages', error: err.message });
	}
};

// Delete a message and its attachments from Cloudinary (if any)
export const deleteMessage = async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.user.id;
		const msg = await Message.findById(id);
		if (!msg) return res.status(404).json({ message: 'Message not found' });
		// Only sender, receiver or admin can delete
		if (String(msg.sender) !== String(userId) && String(msg.receiver) !== String(userId) && req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Not authorized to delete this message' });
		}

		// Delete attachments from Cloudinary if publicId exists
		if (msg.attachments && msg.attachments.length) {
			for (const a of msg.attachments) {
				try {
					const pid = a.publicId || extractPublicId(a.url);
					if (pid) {
						await cloudinary.uploader.destroy(pid, { resource_type: 'auto' });
					}
				} catch (e) {
					console.error('Error deleting cloudinary asset for message attachment', e);
				}
			}
		}

		await msg.remove();
		res.json({ message: 'Message deleted' });
	} catch (err) {
		console.error('Delete message error:', err);
		res.status(500).json({ message: 'Error deleting message', error: err.message });
	}
};

// Edit a message: update content, remove specified attachments, and/or add new attachments
export const editMessage = async (req, res) => {
	try {
		const { id } = req.params;
		const { content } = req.body;
		// removeAttachments can be sent as JSON array (in multipart form it's a string)
		let removeAttachments = req.body.removeAttachments;
		if (removeAttachments && typeof removeAttachments === 'string') {
			try { removeAttachments = JSON.parse(removeAttachments); } catch (e) { removeAttachments = [removeAttachments]; }
		}

		const userId = req.user.id;
		const msg = await Message.findById(id);
		if (!msg) return res.status(404).json({ message: 'Message not found' });
		// Only sender or admin can edit
		if (String(msg.sender) !== String(userId) && req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Not authorized to edit this message' });
		}

		// Remove attachments requested
		if (removeAttachments && Array.isArray(removeAttachments) && removeAttachments.length) {
			const remaining = [];
			for (const a of msg.attachments || []) {
				if (removeAttachments.includes(a.publicId) || removeAttachments.includes(a.url)) {
					try {
						const pid = a.publicId || extractPublicId(a.url);
						if (pid) await cloudinary.uploader.destroy(pid, { resource_type: 'auto' });
					} catch (e) {
						console.error('Error deleting cloudinary asset during edit', e);
					}
				} else {
					remaining.push(a);
				}
			}
			msg.attachments = remaining;
		}

		// Add any new attachments uploaded via multipart (memory upload)
		if (req.files && req.files.length) {
			for (const f of req.files) {
				if (f && f.buffer) {
					try {
						const upl = await uploadBuffer(f.buffer, { folder: 'tahanap/messages' });
						msg.attachments.push({ url: upl.secure_url, originalName: f.originalname, publicId: upl.public_id });
					} catch (e) {
						console.error('Cloudinary upload failed for new attachment during edit', e);
					}
				}
			}
		}

		if (content !== undefined) msg.content = content;

		await msg.save();
		const populated = await Message.findById(msg._id).populate({ path: 'property', select: '_id title price images' });
		res.json(populated);
	} catch (err) {
		console.error('Edit message error:', err);
		res.status(500).json({ message: 'Error editing message', error: err.message });
	}
};
