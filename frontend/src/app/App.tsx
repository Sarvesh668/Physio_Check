//E:\TechFiesta_Final\Physio_Check\frontend\src\app\App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Signup } from './pages/Signup';
import { Login } from './pages/Login';
import { Onboarding } from './pages/patient/Onboarding';
import { PhysioMessages } from './pages/physiotherapist/PhysioMessages';
import { PhysioProfile } from './pages/physiotherapist/PhysioProfile';

// Patient pages
import { Dashboard as PatientDashboard } from './pages/patient/Dashboard';
import { StartWorkout } from './pages/patient/StartWorkout';
import { WorkoutScreen } from './pages/patient/WorkoutScreen';
import { WorkoutSummary } from './pages/patient/WorkoutSummary';
import { Reports } from './pages/patient/Reports';
import { Messages as PatientMessages } from './pages/patient/Messages';
import { Profile as PatientProfile } from './pages/patient/Profile';
import { ChoosePhysio } from './pages/patient/ChoosePhysio';

// Physiotherapist pages
import { Dashboard } from './pages/physiotherapist/Dashboard';
import { PatientAnalysis } from './pages/physiotherapist/PatientAnalysis';

import { Toaster } from './components/ui/sonner';

function ProtectedRoute({ 
  children, 
  allowedRole 
}: { 
  children: React.ReactNode;
  allowedRole?: 'patient' | 'physiotherapist';
}) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If they are trying to access a page meant for the other role
  if (allowedRole && user?.role !== allowedRole) {
    const dashboardPath = user?.role === 'patient' 
      ? (user.onboarded ? (user.physio_id ? '/dashboard' : '/choose-physio') : '/onboarding')
      : '/physiotherapist/dashboard';
    return <Navigate to={dashboardPath} replace />;
  }

  // RESTORED: Force patient to Onboarding if they haven't completed it
  if (user?.role === 'patient' && !user.onboarded && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      {/* Auth Routes */}
      <Route 
        path="/signup" 
        element={isAuthenticated ? (
          <Navigate to={user?.role === 'patient' ? (user.onboarded ? (user.physio_id ? '/dashboard' : '/choose-physio') : '/onboarding') : '/physiotherapist/dashboard'} replace />
        ) : (
          <Signup />
        )} 
      />
      <Route 
        path="/login" 
        element={isAuthenticated ? (
          <Navigate to={user?.role === 'patient' ? (user.onboarded ? (user.physio_id ? '/dashboard' : '/choose-physio') : '/onboarding') : '/physiotherapist/dashboard'} replace />
        ) : (
          <Login />
        )} 
      />

      {/* Patient Routes */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute allowedRole="patient">
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRole="patient">
            <PatientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/start-workout"
        element={
          <ProtectedRoute allowedRole="patient">
            <StartWorkout />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workout/:exerciseId"
        element={
          <ProtectedRoute allowedRole="patient">
            <WorkoutScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workout-summary"
        element={
          <ProtectedRoute allowedRole="patient">
            <WorkoutSummary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRole="patient">
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute allowedRole="patient">
            <PatientMessages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRole="patient">
            <PatientProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/choose-physio"
        element={
          <ProtectedRoute allowedRole="patient">
            <ChoosePhysio />
          </ProtectedRoute>
        }
      />

      {/* Physiotherapist Routes */}
      <Route
        path="/physiotherapist/dashboard"
        element={
          <ProtectedRoute allowedRole="physiotherapist">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/physiotherapist/patients"
        element={
          <ProtectedRoute allowedRole="physiotherapist">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/physiotherapist/patient/:patientId"
        element={
          <ProtectedRoute allowedRole="physiotherapist">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/physiotherapist/patient/:patientId/analysis"
        element={
          <ProtectedRoute allowedRole="physiotherapist">
            <PatientAnalysis />
          </ProtectedRoute>
        }
      />
      <Route
        path="/physiotherapist/messages"
        element={
          <ProtectedRoute allowedRole="physiotherapist">
            <PhysioMessages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/physiotherapist/profile"
        element={
          <ProtectedRoute allowedRole="physiotherapist">
            <PhysioProfile />
          </ProtectedRoute>
        }
      />

      {/* Default Routes */}
      <Route 
        path="/" 
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'patient' ? (user.onboarded ? (user.physio_id ? '/dashboard' : '/choose-physio') : '/onboarding') : '/physiotherapist/dashboard'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}