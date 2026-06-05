import { redirect } from 'next/navigation'

// Root sends workers into the clock flow (/clock bounces to /login when unauthenticated).
// The admin cockpit will take over this route in a later slice; until then there is no
// standalone landing page (the old Phase 0 timesheet mock lived here and was removed).
export default function Home() {
  redirect('/clock')
}
