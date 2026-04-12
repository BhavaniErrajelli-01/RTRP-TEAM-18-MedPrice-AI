import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Chatbot from './components/Chatbot'
import api from './services/api'
import { isSupabaseConfigured, supabase } from './services/supabase'

function App() {
  const [user, setUser] = useState(null)
  const [backendStatus, setBackendStatus] = useState({
    status: 'checking',
    services: {
      supabase: 'unknown',
      smtp: 'unknown',
    },
  })

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    const syncUser = async () => {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user

      if (!sessionUser) {
        setUser(null)
        return
      }

      setUser({
        email: sessionUser.email,
        name:
          sessionUser.user_metadata?.full_name ||
          sessionUser.user_metadata?.name ||
          sessionUser.email?.split('@')[0],
      })
    }

    syncUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user

      if (!sessionUser) {
        setUser(null)
        return
      }

      setUser({
        email: sessionUser.email,
        name:
          sessionUser.user_metadata?.full_name ||
          sessionUser.user_metadata?.name ||
          sessionUser.email?.split('@')[0],
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadHealth = async () => {
      const health = await api.getBackendHealth()
      if (active) {
        setBackendStatus(health)
      }
    }

    loadHealth()
    const intervalId = window.setInterval(loadHealth, 15000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      window.alert('Google sign-in is not configured yet.')
      return
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      window.alert(error.message)
    }
  }

  const handleSignOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null)
      return
    }

    await supabase.auth.signOut()
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col relative w-full overflow-hidden">
        <Navbar
          backendStatus={backendStatus}
          user={user}
          onOpenSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
        />

        <main className="flex-grow flex flex-col pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full z-10">
          <Routes>
            <Route
              path="/"
              element={<Home user={user} onRequireSignIn={handleGoogleSignIn} backendStatus={backendStatus} />}
            />
            <Route
              path="/dashboard"
              element={<Dashboard user={user} onRequireSignIn={handleGoogleSignIn} />}
            />
          </Routes>
        </main>

        {/* Floating Chatbot */}
        <Chatbot />

        {/* Decorative background blobs */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/10 blur-[100px] -z-10 pointer-events-none"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[100px] -z-10 pointer-events-none"></div>
      </div>
    </Router>
  )
}

export default App
