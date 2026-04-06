import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

export const ErrorFallback = ({ error, resetErrorBoundary }) => {
  // When encountering an error in the development mode, rethrow it and don't display the boundary.
  // The parent UI will take care of showing a more helpful dialog.
  if (import.meta.env.DEV) throw error;

  const message = error?.message || 'Unknown runtime error'
  const isChunkLoadFailure = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(message)

  const handleRetry = () => {
    if (isChunkLoadFailure) {
      window.location.reload()
      return
    }

    resetErrorBoundary()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangleIcon />
          <AlertTitle>{isChunkLoadFailure ? 'A portal update is ready' : 'This spark has encountered a runtime error'}</AlertTitle>
          <AlertDescription>
            {isChunkLoadFailure
              ? 'A cached page is still trying to open an older JavaScript file. Reload the portal to pull the latest version.'
              : 'Something unexpected happened while running the application. The error details are shown below. Contact the spark author and let them know about this issue.'}
          </AlertDescription>
        </Alert>
        
        <div className="bg-card border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">Error Details:</h3>
          <pre className="text-xs text-destructive bg-muted/50 p-3 rounded border overflow-auto max-h-32">
            {message}
          </pre>
        </div>
        
        <Button 
          onClick={handleRetry} 
          className="w-full"
          variant="outline"
        >
          <RefreshCwIcon />
          {isChunkLoadFailure ? 'Reload Portal' : 'Try Again'}
        </Button>
      </div>
    </div>
  );
}
