import { apiFetch } from './api'

export interface HealthResponse {
  status: 'ok' | 'degraded'
  uptime: number
  database: 'connected' | 'disconnected'
}

export const getHealth = () => apiFetch<HealthResponse>('/health')
