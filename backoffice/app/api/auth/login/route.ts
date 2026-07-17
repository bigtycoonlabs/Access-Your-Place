import { NextResponse } from 'next/server'

const BACKOFFICE_PASSWORD = process.env.BACKOFFICE_PASSWORD || 'ayp-staff-2025'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    if (password !== BACKOFFICE_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('ayp_backoffice_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
