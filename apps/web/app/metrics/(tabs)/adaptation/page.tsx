import { redirect } from 'next/navigation';

import { AdaptationDeepestBlocks } from '../../../../components/adaptation-deepest-blocks';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { getServerAuthSession } from '../../../../lib/auth';
import { env } from '../../../../lib/env';
import { fetchAdaptationEdges } from '../shared';

export default async function AdaptationPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const adaptation = await fetchAdaptationEdges(session?.accessToken);

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Adaptation edges</h1>
          <p className="text-muted-foreground">
            Surface your deepest training blocks and understand how efficiency evolved across each block. Use
            these summaries to plan when to extend or reload your next progression.
          </p>
        </div>
        <AdaptationDeepestBlocks analysis={adaptation} />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching adaptation edges.';

    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load adaptation edges</AlertTitle>
        <AlertDescription>
          {message}. Ensure the backend API is running and the adaptation edges endpoint is available{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pnpm seed</code>.
        </AlertDescription>
      </Alert>
    );
  }
}
