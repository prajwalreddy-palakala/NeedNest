import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to every request if available
api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('neediest_user') || 'null');
  if (user && user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      // Only force-logout on genuinely protected endpoints, not public ones
      const protectedPaths = ['/auth/me', '/auth/profile', '/items/my-donations', '/notifications', '/requests', '/admin'];
      const isProtected = protectedPaths.some(p => url.includes(p));
      if (isProtected) {
        localStorage.removeItem('neediest_user');
        window.dispatchEvent(new Event('neediest-session-expired'));
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  sendRegisterOtp: (data) => api.post('/auth/send-register-otp', data),
  verifyRegisterOtp: (data) => api.post('/auth/verify-register-otp', data),
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Item APIs
export const itemAPI = {
  getItems: (params) => api.get('/items', { params }),
  getItem: (id) => api.get(`/items/${id}`),
  createItem: (formData) => api.post('/items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateItem: (id, formData) => api.put(`/items/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteItem: (id) => api.delete(`/items/${id}`),
  collectItem: (id) => api.put(`/items/${id}/collect`),
  getMyDonations: () => api.get('/items/my-donations'),
};

// Admin APIs
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  toggleUserStatus: (id) => api.put(`/admin/users/${id}/toggle-status`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getItems: (params) => api.get('/admin/items', { params }),
  approveItem: (id) => api.put(`/admin/items/${id}/approve`),
  removeItem: (id) => api.put(`/admin/items/${id}/remove`),
};

// Notification APIs
export const notificationAPI = {
  getNotifications: () => api.get('/notifications'),
  markAllRead: () => api.put('/notifications/read-all'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
};

// Request APIs
export const requestAPI = {
  createRequest: (data) => api.post('/requests', data),
  getMyRequests: (params) => api.get('/requests/my-requests', { params }),
  getDonorRequests: (params) => api.get('/requests/donor-requests', { params }),
  approveRequest: (id, data) => api.put(`/requests/${id}/approve`, data),
  rejectRequest: (id, data) => api.put(`/requests/${id}/reject`, data),
  markCollected: (id) => api.put(`/requests/${id}/mark-collected`),
  checkRequest: (itemId) => api.get(`/requests/check/${itemId}`),
};

export default api;
