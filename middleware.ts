import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl
  const isPublicRoute = ['/login'].includes(pathname)

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && isPublicRoute) {
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', session.user.id).single()
    const destination = roleData?.role === 'admin' ? '/admin' : '/dashboard'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  if (pathname.startsWith('/admin') && session) {
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', session.user.id).single()
    if (roleData?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

