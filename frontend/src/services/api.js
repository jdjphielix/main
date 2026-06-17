import axios from 'axios';

// Get API base URL from environment or default to /api/v1
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth interceptor - add Bearer token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 and redirect to login
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth token and redirect to login
      sessionStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Leads API
export const leadsApi = {
  getLeads: (params) => apiClient.get('/leads', { params }),
  getLead: (id) => apiClient.get(`/leads/${id}`),
  createLead: (data) => apiClient.post('/leads', data),
  updateLead: (id, data) => apiClient.put(`/leads/${id}`, data),
  deleteLead: (id) => apiClient.delete(`/leads/${id}`),
  enrichLead: (id) => apiClient.post(`/leads/${id}/enrich`),
  convertToProspect: (id, data) => apiClient.post(`/leads/${id}/convert-to-prospect`, data),
  bulkDelete: (ids) => apiClient.post('/leads/bulk-delete', { ids }),
  bulkUpdate: (data) => apiClient.post('/leads/bulk-update', data),
};

// Prospects API
export const prospectsApi = {
  getProspects: (params) => apiClient.get('/prospects', { params }),
  getProspect: (id) => apiClient.get(`/prospects/${id}`),
  createProspect: (data) => apiClient.post('/prospects', data),
  updateProspect: (id, data) => apiClient.put(`/prospects/${id}`, data),
  deleteProspect: (id) => apiClient.delete(`/prospects/${id}`),
  updateStage: (id, stage) => apiClient.patch(`/prospects/${id}/stage`, { stage }),
  updateProbability: (id, probability) => apiClient.patch(`/prospects/${id}/probability`, { probability }),
  lock: (id) => apiClient.post(`/prospects/${id}/lock`),
  unlock: (id) => apiClient.post(`/prospects/${id}/unlock`),
  snooze: (id, duration) => apiClient.post(`/prospects/${id}/snooze`, { duration }),
  bulkDelete: (ids) => apiClient.post('/prospects/bulk-delete', { ids }),
  bulkUpdate: (data) => apiClient.post('/prospects/bulk-update', data),
};

// Callbacks API
export const callbacksApi = {
  getCallbacks: (params) => apiClient.get('/callbacks', { params }),
  getCallback: (id) => apiClient.get(`/callbacks/${id}`),
  createCallback: (data) => apiClient.post('/callbacks', data),
  updateCallback: (id, data) => apiClient.put(`/callbacks/${id}`, data),
  deleteCallback: (id) => apiClient.delete(`/callbacks/${id}`),
  getCallLog: (prospectId) => apiClient.get(`/callbacks/prospect/${prospectId}/log`),
  reschedule: (id, newDateTime) => apiClient.patch(`/callbacks/${id}/reschedule`, { newDateTime }),
  complete: (id, data) => apiClient.post(`/callbacks/${id}/complete`, data),
  bulkDelete: (ids) => apiClient.post('/callbacks/bulk-delete', { ids }),
};

// Documents API
export const documentsApi = {
  getDocuments: (params) => apiClient.get('/documents', { params }),
  getDocument: (id) => apiClient.get(`/documents/${id}`),
  createDocument: (data) => apiClient.post('/documents', data),
  updateDocument: (id, data) => apiClient.put(`/documents/${id}`, data),
  deleteDocument: (id) => apiClient.delete(`/documents/${id}`),
  uploadFile: (file, metadata) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return apiClient.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  downloadFile: (id) => apiClient.get(`/documents/${id}/download`, { responseType: 'blob' }),
  getDocumentsByEntity: (entityType, entityId) =>
    apiClient.get(`/documents/${entityType}/${entityId}`),
};

// Chat API
export const chatApi = {
  getMessages: (params) => apiClient.get('/chat/messages', { params }),
  getMessage: (id) => apiClient.get(`/chat/messages/${id}`),
  sendMessage: (data) => apiClient.post('/chat/messages', data),
  updateMessage: (id, data) => apiClient.put(`/chat/messages/${id}`, data),
  deleteMessage: (id) => apiClient.delete(`/chat/messages/${id}`),
  getConversations: (params) => apiClient.get('/chat/conversations', { params }),
  getConversation: (id) => apiClient.get(`/chat/conversations/${id}`),
  createConversation: (data) => apiClient.post('/chat/conversations', data),
  addReaction: (messageId, emoji) =>
    apiClient.post(`/chat/messages/${messageId}/reactions`, { emoji }),
  removeReaction: (messageId, emoji) =>
    apiClient.delete(`/chat/messages/${messageId}/reactions/${emoji}`),
};

// Notifications API
export const notificationsApi = {
  getNotifications: (params) => apiClient.get('/notifications', { params }),
  getNotification: (id) => apiClient.get(`/notifications/${id}`),
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  deleteNotification: (id) => apiClient.delete(`/notifications/${id}`),
  subscribeToUpdates: (topics) =>
    apiClient.post('/notifications/subscribe', { topics }),
  unsubscribeFromUpdates: (topics) =>
    apiClient.post('/notifications/unsubscribe', { topics }),
};

// Users API
export const usersApi = {
  getCurrentUser: () => apiClient.get('/auth/me'),
  getUser: (id) => apiClient.get(`/users/${id}`),
  getUsers: (params) => apiClient.get('/users', { params }),
  updateProfile: (data) => apiClient.put('/auth/me', data),
  updateUser: (id, data) => apiClient.put(`/users/${id}`, data),
  changePassword: (data) => apiClient.post('/auth/change-password', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient.post('/auth/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteAccount: () => apiClient.delete('/auth/account'),
  getPreferences: () => apiClient.get('/users/me/preferences'),
  updatePreferences: (data) => apiClient.put('/users/me/preferences', data),
};

// Dashboard API
export const dashboardApi = {
  getDashboard: () => apiClient.get('/dashboard'),
  getStatistics: (params) => apiClient.get('/dashboard/statistics', { params }),
  getRecentActivity: (params) => apiClient.get('/dashboard/activity', { params }),
  getUpcomingTasks: (params) => apiClient.get('/dashboard/tasks', { params }),
  getMetrics: (params) => apiClient.get('/dashboard/metrics', { params }),
  getConversionRate: (params) => apiClient.get('/dashboard/conversion-rate', { params }),
  getLeadMetrics: (params) => apiClient.get('/dashboard/lead-metrics', { params }),
  getProspectMetrics: (params) => apiClient.get('/dashboard/prospect-metrics', { params }),
};

// AI API
export const aiApi = {
  enrichData: (data) => apiClient.post('/ai/enrich', data),
  generateInsights: (data) => apiClient.post('/ai/insights', data),
  predictProbability: (data) => apiClient.post('/ai/predict-probability', data),
  generateSummary: (data) => apiClient.post('/ai/summarize', data),
  analyzeText: (data) => apiClient.post('/ai/analyze', data),
  suggestNextActions: (data) => apiClient.post('/ai/suggest-actions', data),
};

// Admin API (if needed)
export const adminApi = {
  getUsers: (params) => apiClient.get('/admin/users', { params }),
  getUser: (id) => apiClient.get(`/admin/users/${id}`),
  createUser: (data) => apiClient.post('/admin/users', data),
  updateUser: (id, data) => apiClient.put(`/admin/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),
  getRoles: (params) => apiClient.get('/admin/roles', { params }),
  getPermissions: (params) => apiClient.get('/admin/permissions', { params }),
  getAuditLog: (params) => apiClient.get('/admin/audit-log', { params }),
  getSystemSettings: () => apiClient.get('/admin/settings'),
  updateSystemSettings: (data) => apiClient.put('/admin/settings', data),
};

export default apiClient;
