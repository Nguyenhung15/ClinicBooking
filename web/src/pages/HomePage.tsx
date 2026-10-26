import { useEffect, useState } from 'react'
import { getHealth, type HealthResponse } from '@/services/health.service'

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <main className="container">
      <h1>Clinic Booking</h1>
      <p>
        API status:{' '}
        <strong>{error ? `error (${error})` : (health?.status ?? 'checking...')}</strong>
      </p>
    </main>
  )
}
