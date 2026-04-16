import type { NextConfig } from "next";

const securityHeaders = [
  // Evita clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Previene MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Fuerza HTTPS durante 1 año (incluye subdominios)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Limita info de referrer a mismo origen
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Deshabilita funcionalidades no usadas
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content Security Policy: ajustar si se añaden CDNs externos
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // unsafe-eval necesario para Next.js dev/prod
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplica a todas las rutas excepto archivos estáticos
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig;
