import './App.css'
import { Routes, Route, BrowserRouter, Outlet } from 'react-router-dom'


// pages
import Dashboard from "./pages/Dashboard"
import Auth from './pages/Auth'
import Course from "./pages/Course"
import Payment from './pages/Payment'
import Report from './pages/Report'
import Users from './pages/Users'
import Assessment from './pages/Assessment'
// import Messages from './pages/Messages'
import Notification from './pages/Notification'
import Support from './pages/Support'
import Community from './pages/Community'

// components
import Header from './components/Header'
import SideBar from './components/Sidebar'
import { useState } from 'react'

// Layout for all logged-in pages
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
          <Outlet /> {/* child routes render here */}
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. PUBLIC ROUTES — no sidebar, no header */}
        <Route path="/auth" element={<Auth />} />

        {/* 2. PRIVATE ROUTES — with sidebar + header */}
        <Route element={<DashboardLayout />}>
          <Route path='/' element={<Dashboard />}/>
          <Route path='/course' element={<Course/>}/>
          <Route path='/payment' element={<Payment />}/>
          <Route path='/report' element={<Report />}/>
          <Route path='/users' element={<Users />}/>
          <Route path='/assessment' element={<Assessment />}/> 
          {/* <Route path='/messages' element={<Messages />}/> */}
          <Route path='/notification' element={<Notification />}/>
          <Route path='/support' element={<Support />}/>
          <Route path='/community' element={<Community />}/>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App