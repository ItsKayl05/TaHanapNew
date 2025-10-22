export const handlePanoUploadLogic = (property = {}) => {
  const panoCount = property?.panoCount || 0;
  const paidForPano = !!property?.paidForPano;

  if (panoCount < 1) {
    return { allowed: true, message: 'Free upload' };
  }
  if (panoCount >= 1 && !paidForPano) {
    return { allowed: false, message: 'Show payment modal' };
  }
  if (panoCount >= 5) {
    return { allowed: false, message: 'Upload limit reached' };
  }
  return { allowed: true, message: 'Allowed (paid)' };
};
