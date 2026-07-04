import axios from "axios";

const BASE_URL = "http://localhost:3000/api";

const api = axios.create({ baseURL: BASE_URL });

// Tự động gắn JWT vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Tự động refresh access token khi bị 401, rồi retry lại request cũ.
// Dùng instance axios riêng (không qua interceptor) để tránh loop vô hạn.
let refreshPromise = null;

const clearSessionAndRedirect = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  window.location.href = "/login";
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const status = err.response?.status;

    if (status !== 401 || originalRequest._retry || originalRequest.url?.includes("/auth/")) {
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      clearSessionAndRedirect();
      return Promise.reject(err);
    }

    originalRequest._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${BASE_URL}/auth/refresh`, { refreshToken })
          .finally(() => { refreshPromise = null; });
      }
      const { data } = await refreshPromise;
      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);

      originalRequest.headers.Authorization = `Bearer ${data.token}`;
      return api(originalRequest);
    } catch (refreshErr) {
      // Chỉ đăng xuất khi backend xác nhận refresh token không hợp lệ/hết hạn (401).
      // Lỗi khác (429 rate-limit, mất mạng, 500...) chỉ là tạm thời — không xóa phiên,
      // để lần poll kế tiếp tự thử lại thay vì bắt người dùng đăng nhập lại oan.
      if (refreshErr.response?.status === 401) {
        clearSessionAndRedirect();
      }
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
