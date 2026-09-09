import { ThemeProvider } from './context/ThemeContext'
import { AppRoutes } from './routes'
import { Toaster } from 'sonner'

export default function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  )
}