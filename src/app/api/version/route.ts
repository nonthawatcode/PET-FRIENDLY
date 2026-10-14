// Tells open pages which build is live, so they can offer an "update" button after a deploy.
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID }, { headers: { 'cache-control': 'no-store' } })
}
