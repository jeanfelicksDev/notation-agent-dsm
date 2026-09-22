import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const SESSION_COOKIE_NAME = 'eval_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    const url = new URL('/', request.url)
    if (pathname.startsWith('/admin')) {
      url.searchParams.set('reason', 'admin_required')
    } else {
      url.searchParams.set('reason', 'auth_required')
    }
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/evaluer/:path*', '/admin/:path*'],
}
