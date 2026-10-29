/**
 * Helper function to get doctor image from public/images folder
 * Maps doctor fullName to image filename
 */

// List of available images in public/images
const AVAILABLE_IMAGES = [
  'dovanthanh.jpg',
  'hanuthuynhi.jpg',
  'huynhquocvu.jpg',
  'huynhtronghieu.jpg',
  'leduongtien.jpg',
  'nguyenduclu.jpg',
  'nguyenquanghai.jpg',
  'nguyenthimynuong.jpg',
  'nguyentienhung.jpg',
  'nguyenvanxung.jpg',
  'phamhongphuc.jpg',
  'phanthixuanphuong.jpg',
  'tovietthuan.jpg',
  'tranthingocnga.jpg',
];

/**
 * Normalize Vietnamese name to match image filename
 * Example: "Đỗ Văn Thành" -> "dovanthanh"
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/\s+/g, '') // Remove spaces
    .trim();
}

/**
 * Get image path for a doctor based on their full name
 * Returns /images/{filename}.jpg or null if not found
 */
export function getDoctorImagePath(fullName: string | undefined | null): string | null {
  if (!fullName) {
    return null;
  }

  const normalized = normalizeName(fullName);
  
  // Try to find matching image
  const matchedImage = AVAILABLE_IMAGES.find((img) => {
    const imgName = img.replace('.jpg', '');
    return imgName === normalized || imgName.includes(normalized) || normalized.includes(imgName);
  });

  if (matchedImage) {
    return `/images/${matchedImage}`;
  }

  return null;
}

/**
 * Get image path with fallback to placeholder
 * Returns null if no image found (to show placeholder div instead)
 */
export function getDoctorImagePathWithFallback(fullName: string | undefined | null): string | null {
  const imagePath = getDoctorImagePath(fullName);
  return imagePath;
}

