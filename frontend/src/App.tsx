import { Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
      </Routes>
    </div>
  )
}
