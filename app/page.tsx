import { Suspense } from "react"
import Dashboard from "@/components/dashboard"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import "@/styles/globals.css"
import Link from "next/link"

declare global {
  interface Window {
    dataLayer: any[] | undefined;
  }
}

export default function Home() {
  return (
    
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
      <img src="https://cdn.7tv.app/emote/01JJATQQM8STYV57WK3837PNAQ/2x.webp" width="64" height="64" alt="pogg" className="image"/><img src="https://cdn.7tv.app/emote/01GVBVKCW8000DFD72REG18523/2x.webp" width="192" height="64" alt="pogg" className="image"/><h1 className="mb-8 text-3xl font-bold">GTA RP Player Count Tracker</h1>
        <h1 className="head2">Data updates every 5 mins | Data starts at 05/04/25</h1>
        <h6> </h6>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </div>
      <footer className="mt-12 pb-8">
        <p className="footer"> Made by <a href="https://twitch.tv/alantiix"> twitch.tv/alantiix </a> </p>
        <div className="flex flex-wrap gap-2 justify-center my-2">
          <a className="links" href="https://forms.office.com/r/r1rXgAGx6V"> Give me your feedback! </a>
          <span className="text-muted-foreground">•</span>
          <Link href="/changelog" className="links">View Changelog</Link>
        </div>
        <p className="footer">Data mined from the FiveM API (https://servers-live.fivem.net/api/servers/) and Twitch's API</p>
      </footer>
    </main>
  )

}
