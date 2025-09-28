'use client';

import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { uploadFitFiles } from '../lib/api';
import { env } from '../lib/env';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import type { UploadResponse } from '../types/activity';

interface FileUploadProps {
  onUploaded?: (activityIds: string[]) => void;
  onAuthRequired?: () => void;
}

export function FileUpload({ onUploaded, onAuthRequired }: FileUploadProps) {
  const { data: session, status: authStatus } = useSession();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] =
    useState<'idle' | 'uploading' | 'error' | 'success' | 'partial'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResponse | null>(null);

  async function handleUpload() {
    if (env.authEnabled && authStatus !== 'authenticated') {
      onAuthRequired?.();
      setUploadStatus('error');
      setMessage('Please sign in to upload activities.');
      return;
    }
    if (files.length === 0) {
      setMessage('Please choose at least one .FIT file to upload.');
      setUploadStatus('error');
      return;
    }
    try {
      setUploadStatus('uploading');
      setMessage(null);
      setResults(null);
      const response = await uploadFitFiles(files, session?.accessToken);
      setResults(response);

      if (response.uploads.length === 0) {
        const failureMessage = response.failures[0]?.error ?? 'Upload failed.';
        setUploadStatus('error');
        setMessage(failureMessage);
        return;
      }

      const successCount = response.uploads.length;
      const failureCount = response.failures.length;
      const successMessage =
        failureCount === 0
          ? `Uploaded ${successCount} file${successCount > 1 ? 's' : ''}. Ready to compute metrics.`
          : `Uploaded ${successCount} file${successCount > 1 ? 's' : ''}, ${failureCount} failed.`;

      setUploadStatus(failureCount === 0 ? 'success' : 'partial');
      setMessage(successMessage);
      onUploaded?.(response.uploads.map((upload) => upload.activityId));
    } catch (error) {
      setUploadStatus('error');
      setMessage((error as Error).message);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <UploadCloud className="h-5 w-5" />
          <span>Upload a Garmin FIT file</span>
        </CardTitle>
        <CardDescription>
          We normalize your time series, store the ride, and let you compute extensible metrics like
          the HR-to-Cadence Scaling Ratio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept=".fit"
          multiple
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            setFiles(selected);
            setUploadStatus('idle');
            setMessage(null);
            setResults(null);
          }}
        />
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleUpload}
            disabled={uploadStatus === 'uploading'}
          >
            {uploadStatus === 'uploading' ? 'Uploading…' : 'Upload FIT file'}
          </Button>
          {files.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {files.length === 1
                ? files[0]?.name
                : `${files.length} files selected`}
            </span>
          ) : null}
        </div>
        {uploadStatus !== 'idle' && message ? (
          <Alert variant={uploadStatus === 'error' ? 'destructive' : 'default'}>
            <AlertTitle>
              {uploadStatus === 'error'
                ? 'Upload failed'
                : uploadStatus === 'partial'
                  ? 'Upload complete with issues'
                  : 'Upload complete'}
            </AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        {results ? (
          <div className="space-y-2">
            {results.uploads.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-foreground">Successful uploads</p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {results.uploads.map((upload) => (
                    <li key={upload.activityId}>{upload.fileName}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {results.failures.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-destructive">Failed uploads</p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {results.failures.map((failure, index) => (
                    <li key={`${failure.fileName}-${index}`}>
                      {failure.fileName}: {failure.error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
