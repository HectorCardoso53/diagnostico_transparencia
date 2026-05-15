import { NextRequest, NextResponse } from 'next/server'

const publicPaths = ['/login']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))
  const isAuth = req.cookies.has('is_auth')

  if (!isPublic && !isAuth) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isPublic && isAuth) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
