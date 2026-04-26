import { Route, Routes } from 'react-router-dom'
import Footer from './components/layout/Footer'
import Navbar from './components/layout/Navbar'
import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'
import Home from './pages/landing/home'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </div>
      <Footer />
    </div>
  )
}
