import './App.css'
import { Routes, Route, BrowserRouter, Outlet, Navigate } from 'react-router-dom'
import { useState } from 'react'

// pages
import Dashboard from "./pages/Dashboard"
import Auth from './pages/Auth'
import Course from "./pages/Course"
import Payment from './pages/Payment'
import Report from './pages/Report'
import Users from './pages/Users'
import Assessment from './pages/Assessment'
import Notification from './pages/Notification'
import Support from './pages/Support'
import Community from './pages/Community'

// components
import Header from './components/Header'
import SideBar from './components/Sidebar'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("adminAccessToken");
  const expiry = localStorage.getItem("adminTokenExpiry");

  if (!token ||!expiry || Date.now() > Number(expiry)) {
    localStorage.removeItem("adminAccessToken");
    localStorage.removeItem("adminRefreshToken");
    localStorage.removeItem("adminTokenExpiry");
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  return (
    <div className="flex w-full bg-[#f8fafc] min-h-screen">
      <SideBar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

       <div className="flex-1 flex flex-col min-h-screen md:ml-60">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 w-full p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC - Auth is now "/" */}
        <Route path="/" element={<Auth />} />

        {/* PRIVATE */}
        <Route element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route path='/dashboard' element={<Dashboard />}/>
          <Route path='/course' element={<Course/>}/>
          <Route path='/payment' element={<Payment />}/>
          <Route path='/report' element={<Report />}/>
          <Route path='/users' element={<Users />}/>
          <Route path='/assessment' element={<Assessment />}/>
          <Route path='/notification' element={<Notification />}/>
          <Route path='/support' element={<Support />}/>
          <Route path='/community' element={<Community />}/>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App