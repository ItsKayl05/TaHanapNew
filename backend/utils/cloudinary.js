import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload a buffer using upload_stream. Returns a promise resolving to result.
export const uploadBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// Extract cloudinary public_id from a secure_url or URL
export const extractPublicId = (url) => {
  try {
    if (!url) return null;
    const u = new URL(url);
    // path like /<cloud_name>/image/upload/v12345/folder/name.jpg
    const parts = u.pathname.split('/');
    // find the segment after 'upload'
    const uploadIdx = parts.findIndex(p => p === 'upload');
    if (uploadIdx === -1) return null;
    // public id is everything after 'upload' (strip version if present)
    let publicParts = parts.slice(uploadIdx + 1);
    // remove version segment if matches v12345
    if (publicParts.length && /^v\d+$/.test(publicParts[0])) publicParts = publicParts.slice(1);
    let publicId = publicParts.join('/');
    // remove file extension
    publicId = publicId.replace(/\.[^.]+$/, '');
    return publicId;
  } catch (e) {
    return null;
  }
};

export default cloudinary;
