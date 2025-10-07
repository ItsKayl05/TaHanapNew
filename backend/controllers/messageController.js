import Message from '../models/Message.js';
import User from '../models/User.js';
import Property from '../models/Property.js';
import { cloudinary } from '../config/cloudinary.js';

// Send message with Cloudinary attachments
export const sendMessage = async (req, res) => {
    try {
        const { receiver, content, property, attachments = [] } = req.body;
        
        if (!receiver) {
            return res.status(400).json({ error: 'Receiver is required' });
        }

        if (!content && (!attachments || attachments.length === 0)) {
            return res.status(400).json({ error: 'Message content or attachment is required' });
        }

        // Check if receiver exists
        const receiverUser = await User.findById(receiver);
        if (!receiverUser) {
            return res.status(404).json({ error: 'Receiver not found' });
        }

        // Handle file uploads if any
        let uploadedAttachments = [];
        if (req.files && req.files.length > 0) {
            for (let file of req.files) {
                try {
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'auto',
                                folder: 'tahanap/messages',
                                transformation: [
                                    { width: 1200, height: 1200, crop: 'limit', quality: 'auto' }
                                ]
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                        uploadStream.end(file.buffer);
                    });

                    uploadedAttachments.push({
                        url: uploadResult.secure_url,
                        originalName: file.originalname,
                        publicId: uploadResult.public_id,
                        fileType: uploadResult.resource_type === 'image' ? 'image' : 
                                  uploadResult.resource_type === 'video' ? 'video' : 'document',
                        size: uploadResult.bytes,
                        width: uploadResult.width,
                        height: uploadResult.height
                    });
                } catch (uploadError) {
                    console.error('Cloudinary upload error:', uploadError);
                    // Continue with other files if one fails
                }
            }
        }

        // Use attachments from request body (if already uploaded from frontend)
        const finalAttachments = attachments.length > 0 ? attachments : uploadedAttachments;

        const message = new Message({
            sender: req.user.id,
            receiver,
            content: content?.trim(),
            property: property || undefined,
            attachments: finalAttachments
        });

        await message.save();
        
        // Populate sender and property info
        await message.populate('sender', 'name profilePic');
        await message.populate('property', 'title price images');

        // Emit socket event for real-time update
        if (req.app.get('socketio')) {
            req.app.get('socketio').to(receiver).emit('receiveMessage', message);
        }

        res.status(201).json(message);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// Get messages between users
export const getMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        const messages = await Message.find({
            $or: [
                { sender: currentUserId, receiver: userId },
                { sender: userId, receiver: currentUserId }
            ]
        })
        .populate('sender', 'name profilePic')
        .populate('property', 'title price images')
        .sort({ createdAt: 1 });

        // Mark messages as read
        await Message.updateMany(
            {
                sender: userId,
                receiver: currentUserId,
                read: false
            },
            { read: true }
        );

        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

// Get message threads for sidebar
export const getMessageThreads = async (req, res) => {
    try {
        const userId = req.user.id;

        const threads = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: userId },
                        { receiver: userId }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$sender', userId] },
                            '$receiver',
                            '$sender'
                        ]
                    },
                    lastMessage: { $first: '$$ROOT' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { 
                                    $and: [
                                        { $eq: ['$receiver', userId] },
                                        { $eq: ['$read', false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    'user.password': 0,
                    'user.__v': 0
                }
            },
            {
                $sort: { 'lastMessage.createdAt': -1 }
            }
        ]);

        res.json(threads);
    } catch (error) {
        console.error('Get threads error:', error);
        res.status(500).json({ error: 'Failed to fetch message threads' });
    }
};

// Edit message
export const editMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (message.sender.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to edit this message' });
        }

        // Check if message is within editable time (e.g., 15 minutes)
        const editableTime = 15 * 60 * 1000; // 15 minutes in milliseconds
        if (Date.now() - new Date(message.createdAt).getTime() > editableTime) {
            return res.status(400).json({ error: 'Message can no longer be edited' });
        }

        message.content = content;
        message.edited = true;
        await message.save();

        await message.populate('sender', 'name profilePic');
        await message.populate('property', 'title price images');

        res.json(message);
    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ error: 'Failed to edit message' });
    }
};

// Delete message
export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (message.sender.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        // Delete attachments from Cloudinary
        if (message.attachments && message.attachments.length > 0) {
            for (let attachment of message.attachments) {
                try {
                    await cloudinary.uploader.destroy(attachment.publicId);
                } catch (cloudinaryError) {
                    console.error('Error deleting from Cloudinary:', cloudinaryError);
                }
            }
        }

        await Message.findByIdAndDelete(id);

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};