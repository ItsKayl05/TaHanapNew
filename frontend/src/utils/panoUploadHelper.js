export const handlePanoUploadLogic = (params = {}) => {
  // ✅ FIX: Use currentCount instead of panoCount
  const currentCount = params.currentCount || 0;
  const paidForPano = !!params.paidForPano;

  console.log('🔄 FIXED Pano Upload Logic:', { currentCount, paidForPano });

  // ✅ CORRECT LOGIC:
  // - First panorama (currentCount = 0): FREE
  // - Second panorama (currentCount = 1): Requires payment
  if (currentCount === 0) {
    return { allowed: true, message: 'Free upload - first panorama' };
  }
  if (currentCount >= 1 && !paidForPano) {
    return { allowed: false, message: 'Show payment modal' };
  }
  if (currentCount >= 5) {
    return { allowed: false, message: 'Upload limit reached' };
  }
  return { allowed: true, message: 'Allowed (paid)' };
};