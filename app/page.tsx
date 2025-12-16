export default function Home() {
  return (
    <main style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
        Я изучаю Next.js
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#666' }}>
        Минимальное приложение успешно создано
      </p>
    </main>
  )
}

