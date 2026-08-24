import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Signup from './pages/SignUp';
import SignIn from './pages/SignIn';
import Start from './pages/Start';
import Home from './pages/Home';
import IoTSimulator from './pages/IoTSimulator';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/admin/iot-simulator" element={<ProtectedRoute><IoTSimulator /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
