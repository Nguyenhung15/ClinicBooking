import axios from 'axios';

export const base: string = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

// Debug: Log base URL để kiểm tra
console.log('API Base URL:', base);

export const http = axios.create({
  baseURL: base,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

interface AxiosErrorWithResponse extends Error {
  response?: unknown;
  status?: number;
}

http.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    const axiosError = err as { response?: { data?: { message?: string; error?: string }; status?: number }; message?: string };
    const message =
      axiosError?.response?.data?.message ||
      axiosError?.response?.data?.error ||
      axiosError?.message ||
      'Đã có lỗi xảy ra';
    // Create error object with status code for better error handling
    const error: AxiosErrorWithResponse = new Error(message);
    error.response = axiosError?.response;
    error.status = axiosError?.response?.status;
    return Promise.reject(error);
  }
);

  http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});