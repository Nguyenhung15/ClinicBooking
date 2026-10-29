// src/api/image.ts
import { http, base } from "./http";

export type Image = {
  id?: number;
  imageUrl: string;
  doctorId?: number;
  specialtyId?: number;
};

/**
 * Helper function để lấy full URL của ảnh
 * - Backend có thể trả về:
 *   1. Absolute URL: "http://localhost:8080/uploads/doctors/xxx.jpg" -> dùng luôn
 *   2. Relative path: "/uploads/doctors/xxx.jpg" -> prefix với base URL
 * - Nếu base URL không có, dùng relative path (browser sẽ resolve từ current origin)
 */
export function getImageFullUrl(imageUrl: string | undefined | null): string | null {
  if (!imageUrl) {
    console.log('[getImageFullUrl] No imageUrl provided');
    return null;
  }
  
  console.log('[getImageFullUrl] Input:', imageUrl, 'Base:', base);
  
  // Nếu đã là absolute URL (http:// hoặc https://)
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    // Backend trả về URL dạng: http://localhost:8080/uploads/doctors/xxx.jpg
    // Cần chuyển thành: http://localhost:8080/images/file/uploads/doctors/xxx.jpg
    // Hoặc nếu đã có /images/file/ thì giữ nguyên
    if (imageUrl.includes('/uploads/') && !imageUrl.includes('/images/file/')) {
      // Chuyển từ /uploads/... sang /images/file/uploads/...
      const urlObj = new URL(imageUrl);
      const pathAfterDomain = urlObj.pathname; // /uploads/doctors/xxx.jpg
      const newUrl = `${urlObj.protocol}//${urlObj.host}/images/file${pathAfterDomain}`;
      console.log('[getImageFullUrl] Converted to /images/file/ endpoint:', newUrl);
      return newUrl;
    }
    console.log('[getImageFullUrl] Absolute URL, using as-is:', imageUrl);
    return imageUrl;
  }
  
  // Nếu là relative path (bắt đầu bằng /)
  if (imageUrl.startsWith("/")) {
    // Nếu path bắt đầu bằng /uploads/, chuyển sang /images/file/uploads/
    if (imageUrl.startsWith("/uploads/")) {
      const newPath = `/images/file${imageUrl}`;
      if (base) {
        const cleanBase = base.replace(/\/api(?:\/v\d+)?\/?$/, '');
        const fullUrl = `${cleanBase}${newPath}`;
        console.log('[getImageFullUrl] Converted relative /uploads/ to /images/file/ endpoint:', fullUrl);
        return fullUrl;
      }
      console.log('[getImageFullUrl] Converted relative /uploads/ to /images/file/ endpoint:', newPath);
      return newPath;
    }
    
    // Các relative path khác
    if (base) {
      const cleanBase = base.replace(/\/api(?:\/v\d+)?\/?$/, '');
      const fullUrl = `${cleanBase}${imageUrl}`;
      console.log('[getImageFullUrl] Built URL from base:', fullUrl);
      return fullUrl;
    }
    console.log('[getImageFullUrl] No base, using relative:', imageUrl);
    return imageUrl;
  }
  
  // Trường hợp khác (không bắt đầu bằng /), trả về nguyên
  console.log('[getImageFullUrl] Other format, using as-is:', imageUrl);
  return imageUrl;
}

/**
 * GET /images/doctor/{doctorId}
 * - Backend luôn trả về Image (có default image nếu chưa có)
 * - Trả về Image hoặc null nếu có lỗi
 */
export async function getDoctorImage(doctorId: number): Promise<Image | null> {
  try {
    const res = await http.get(`/images/doctor/${doctorId}`);
    const image = res.data as Image;
    
    // Debug: log để kiểm tra
    console.log(`[getDoctorImage] Doctor ${doctorId} image:`, image);
    
    // Kiểm tra xem có phải default image không (nếu cần)
    if (image?.imageUrl?.includes('default/default-doctor.jpg')) {
      // Có thể coi như chưa có ảnh thật
      return null;
    }
    
    return image;
  } catch (err: unknown) {
    const error = err as { response?: { status?: number }; message?: string };
    const status = error?.response?.status;
    const message: string | undefined = error?.message;

    console.error(`[getDoctorImage] Error for doctor ${doctorId}:`, status, message);

    // Nếu BE trả 404 hoặc message kiểu "does not have an image" thì coi như chưa có ảnh
    if (status === 404 || message?.includes("does not have an image")) {
      return null;
    }
    throw err;
  }
}

/**
 * POST /images/doctor/{doctorId}
 * - Upload ảnh mới cho bác sĩ (bác sĩ chưa có image)
 * - Backend nhận MultipartFile và lưu vào uploads/doctors/, trả về Image với imageUrl
 */
export async function uploadDoctorImage(doctorId: number, file: File): Promise<Image> {
  const formData = new FormData();
  formData.append("file", file);

  // Không set Content-Type header - axios sẽ tự động set với boundary cho FormData
  // Cần delete Content-Type từ default headers để browser tự set
  const res = await http.post(`/images/doctor/${doctorId}`, formData, {
    headers: {
      "Content-Type": undefined, // Xóa Content-Type để browser tự set với boundary
    },
  });
  return res.data as Image;
}

/**
 * PUT /images/doctor/{doctorId}
 * - Cập nhật ảnh cho bác sĩ (bác sĩ đã có image)
 * - Backend nhận MultipartFile và cập nhật file trong uploads/doctors/, trả về Image với imageUrl mới
 */
export async function updateDoctorImageFile(doctorId: number, file: File): Promise<Image> {
  const formData = new FormData();
  formData.append("file", file);

  // Không set Content-Type header - axios sẽ tự động set với boundary cho FormData
  // Cần delete Content-Type từ default headers để browser tự set
  const res = await http.put(`/images/doctor/${doctorId}`, formData, {
    headers: {
      "Content-Type": undefined, // Xóa Content-Type để browser tự set với boundary
    },
  });
  return res.data as Image;
}

/**
 * DELETE /images/doctor/{doctorId}
 * - Xóa ảnh bác sĩ
 */
export async function deleteDoctorImage(doctorId: number): Promise<void> {
  await http.delete(`/images/doctor/${doctorId}`);
}
