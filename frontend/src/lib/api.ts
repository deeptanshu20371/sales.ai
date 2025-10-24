import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await api.post('/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  register: async (username: string, email: string, password: string) => {
    const response = await api.post('/register', {
      username,
      email,
      password,
    });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/me');
    return response.data;
  },

  googleLogin: () => {
    window.location.href = `${API_BASE_URL}/login/google`;
  },
};

// Generate API
export const generateApi = {
  generateMessage: async (data: {
    intent?: string;
    profileInfo: {
      name?: string;
      title?: string;
      company?: string;
    };
    extendedProfile: {
      about?: string;
      experiences?: Array<{
        title?: string;
        company?: string;
        dateRange?: string;
        location?: string;
        description?: string;
      }>;
      education?: Array<{
        school?: string;
        degree?: string;
        fieldOfStudy?: string;
        dateRange?: string;
      }>;
      awards?: Array<{
        name?: string;
        issuer?: string;
        date?: string;
        description?: string;
      }>;
      recentPosts?: Array<Record<string, any>>;
    };
  }) => {
    const response = await api.post('/api/generate', data);
    return response.data;
  },
};

// Health check
export const healthApi = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};
