import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Signup from './pages/SignUp';
import SignIn from './pages/SignIn';
import Start from './pages/Start';
import Home from './pages/Home';
import Station from './pages/Station';
import IoTSimulator from './pages/IoTSimulator';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Payment from './pages/Payment';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/AdminRoute';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/station/:stationId" element={<ProtectedRoute><Station /></ProtectedRoute>} />
          <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="/admin/iot-simulator" element={<ProtectedRoute><IoTSimulator /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
