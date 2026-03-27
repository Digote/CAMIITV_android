// services/api.ts
import axios from 'axios';
import { getToken, removeToken } from '../utils/authToken';
import { router } from 'expo-router';

const api = axios.create({
  // baseURL: 'http://192.168.0.154/CAMII_TV/public/api', // usar o ip da rede
  baseURL: 'https://tv.camii.com.br/api',
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Trata erro de token inválido
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
      router.replace('/login'); // redireciona para login
    }
    return Promise.reject(error);
  }
);

export default api;
