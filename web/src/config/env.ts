const apiUrl = import.meta.env.VITE_API_URL as string | undefined

export const env = {
  apiUrl: apiUrl ?? 'http://localhost:3000/api',
} as const
