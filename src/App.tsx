import './App.css'
import { Routes, Route, BrowserRouter, Outlet, Navigate } from 'react-router-dom'
import { useState } from 'react'

// pages
import Dashboard from "./pages/Dashboard"
import Auth from './pages/Auth'
import Course from "./pages/Course"
// import Payment from './pages/Payment'
import Users from './pages/Users'
import Assessment from './pages/Assessment'
import CertificationsSignatoriesPage from './pages/certificationssginatoriesPage'
import Discussions from './pages/Discussions'
import Share from './pages/Share'
// import AddAdmin from './pages/AddAdmin'

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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") === "true"
    } catch {
      return false
    }
  })

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem("sidebarCollapsed", String(next))
      } catch {}
      return next
    })
  }

  return (
    <div className="flex w-full bg-[#f8fafc] min-h-screen">
      <SideBar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

       <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? "md:ml-[72px]" : "md:ml-64 lg:ml-72 xl:ml-[19rem]"}`}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        <main className="flex-1 w-full p-3 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden">
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
          {/* <Route path='/payment' element={<Payment />}/> */}
          <Route path='/users' element={<Users />}/>
          <Route path='/assessment' element={<Assessment />}/>
          <Route path='/discussions' element={<Discussions />}/>
          <Route path='/certificate' element={<CertificationsSignatoriesPage />}/>
          <Route path='/share' element={<Share />}/>
          {/* <Route path='/add-admin' element={<AddAdmin />}/> */}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App