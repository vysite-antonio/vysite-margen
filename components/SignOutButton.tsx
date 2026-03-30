'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const supabase = createClient()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button onClick={handleSignOut}
      className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
      Salir
    </button>
  )
}

