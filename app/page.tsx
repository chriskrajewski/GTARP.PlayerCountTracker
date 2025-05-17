import { Suspense } from "react"
import Dashboard from "@/components/dashboard"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import "@/styles/globals.css"
import Link from "next/link"
import { DataStartPopup } from "@/components/data-start-popup"
import { DataRefreshPopup } from "@/components/data-refresh-popup"
import { TwitchIcon, DatabaseIcon, ExternalLinkIcon, MessageSquareIcon, ClipboardListIcon } from "lucide-react"

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
        <h1 className="head2"><DataRefreshPopup /> | <DataStartPopup /></h1>
        <h6> </h6>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </div>
      <footer className="mt-12 pb-8 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <TwitchIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          <p className="footer font-medium">Made by <a href="https://twitch.tv/alantiix" className="text-purple-500 dark:text-purple-400 hover:underline flex items-center">
            twitch.tv/alantiix
            <ExternalLinkIcon className="h-3 w-3 ml-1 inline" />
          </a></p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 my-3 px-4">
          <a href="https://forms.office.com/r/r1rXgAGx6V" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors text-sm font-medium">
            <MessageSquareIcon className="h-4 w-4" />
            Give me your feedback
          </a>
          
          <Link href="/changelog" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-colors text-sm font-medium">
            <ClipboardListIcon className="h-4 w-4" />
            View Changelog
          </Link>
        </div>

        <div className="flex items-center gap-2 mt-2 text-center">
          <DatabaseIcon className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <p className="footer text-sm text-muted-foreground">
            Data mined from <a href="https://servers-live.fivem.net/api/servers/" className="text-blue-500 dark:text-blue-400 hover:underline inline-flex items-center">
              FiveM API<ExternalLinkIcon className="h-3 w-3 ml-0.5" />
            </a> and <a href="https://dev.twitch.tv/" className="text-purple-500 dark:text-purple-400 hover:underline inline-flex items-center">
              Twitch's API<ExternalLinkIcon className="h-3 w-3 ml-0.5" />
            </a>
          </p>
        </div>
      </footer>
    </main>
  )

}
