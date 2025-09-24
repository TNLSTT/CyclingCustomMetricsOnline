'use client';

import { useState } from 'react';
import { UploadCloud } from 'lucide-react';

import { uploadFitFile } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface FileUploadProps {
  onUploaded?: (activityId: string) => void;
}

export function FileUpload({ onUploaded }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) {
      setMessage('Please choose a .FIT file to upload.');
      setStatus('error');
      return;
    }
    try {
      setStatus('uploading');
      setMessage(null);
      const response = await uploadFitFile(file);
      setStatus('success');
      setMessage('Upload successful. Ready to compute metrics.');
      onUploaded?.(response.activityId);
    } catch (error) {
      setStatus('error');
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
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setStatus('idle');
            setMessage(null);
          }}
        />
        <div className="flex items-center space-x-2">
          <Button onClick={handleUpload} disabled={status === 'uploading'}>
            {status === 'uploading' ? 'Uploading…' : 'Upload FIT file'}
          </Button>
          {file ? <span className="text-xs text-muted-foreground">{file.name}</span> : null}
        </div>
        {status !== 'idle' && message ? (
          <Alert variant={status === 'error' ? 'destructive' : 'default'}>
            <AlertTitle>{status === 'error' ? 'Upload failed' : 'Upload complete'}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
