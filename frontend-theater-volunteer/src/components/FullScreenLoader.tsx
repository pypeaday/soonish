import { Loader2 } from 'lucide-react'

interface FullScreenLoaderProps {
  message?: string
}

export const FullScreenLoader = ({ message = 'Loading...' }: FullScreenLoaderProps) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-rose-50">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-600" />
        <p className="mt-4 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  )
}
