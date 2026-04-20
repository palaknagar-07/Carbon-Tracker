import axios from 'axios';
import { auth } from '../firebase';

const baseURL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').replace(
  /\/$/,
  ''
);

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
