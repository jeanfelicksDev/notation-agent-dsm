import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    const url = new URL('/', request.url)
    url.searchParams.set('reason', 'auth_required')
    return NextResponse.redirect(url)
  }

  // Pour les routes admin, on redirige les non-admins vers /evaluer
  if (pathname.startsWith('/admin')) {
    // La vérification fine du rôle se fait dans les API routes côté serveur
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/evaluer/:path*', '/admin/:path*'],
}
