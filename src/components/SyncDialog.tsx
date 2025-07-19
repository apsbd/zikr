'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CloudUpload, CloudDownload, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { offlineService } from '@/lib/offline';
import { useAuth } from '@/contexts/auth';

interface SyncDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSyncComplete?: () => void;
}

type SyncStatus = 'idle' | 'uploading' | 'downloading' | 'success' | 'error';

export function SyncDialog({ open, onOpenChange, onSyncComplete }: SyncDialogProps) {
    const { user } = useAuth();
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleUpload = async () => {
        if (!user) return;
        
        setSyncStatus('uploading');
        setProgress(0);
        setError(null);
        setMessage('Preparing to upload your progress...');

        try {
            // Ensure offline service is initialized
            await offlineService.init();
            
            setProgress(20);
            setMessage('Uploading your progress to the server...');
            
            // Perform upload sync (local → server)
            const result = await offlineService.performManualUpload(user.id);
            
            setProgress(100);
            
            if (result.success) {
                setSyncStatus('success');
                setMessage(`Successfully uploaded ${result.synced_count} items to the server.`);
            } else {
                throw new Error('Upload failed');
            }
            
            // Notify parent component
            setTimeout(() => {
                onSyncComplete?.();
                onOpenChange(false);
                setSyncStatus('idle');
                setProgress(0);
            }, 2000);
            
        } catch (err: any) {
            console.error('Upload error:', err);
            setSyncStatus('error');
            setError(err.message || 'Failed to upload progress. Please check your connection and try again.');
            setProgress(0);
        }
    };

    const handleDownload = async () => {
        if (!user) return;
        
        setSyncStatus('downloading');
        setProgress(0);
        setError(null);
        setMessage('Preparing to download progress from server...');

        try {
            // Ensure offline service is initialized
            await offlineService.init();
            
            setProgress(20);
            setMessage('Downloading progress from the server...');
            
            // Perform download sync (server → local)
            const result = await offlineService.performManualDownload(user.id);
            
            setProgress(100);
            
            if (result.success) {
                setSyncStatus('success');
                setMessage(`Successfully downloaded ${result.synced_count} items from the server.`);
            } else {
                throw new Error('Download failed');
            }
            
            // Notify parent component
            setTimeout(() => {
                onSyncComplete?.();
                onOpenChange(false);
                setSyncStatus('idle');
                setProgress(0);
            }, 2000);
            
        } catch (err: any) {
            console.error('Download error:', err);
            setSyncStatus('error');
            setError(err.message || 'Failed to download progress. Please check your connection and try again.');
            setProgress(0);
        }
    };

    const resetDialog = () => {
        setSyncStatus('idle');
        setProgress(0);
        setMessage('');
        setError(null);
    };

    return (
        <Dialog open={open} onOpenChange={(open) => {
            if (!open) resetDialog();
            onOpenChange(open);
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Sync Progress</DialogTitle>
                    <DialogDescription>
                        Choose how you want to sync your progress
                    </DialogDescription>
                </DialogHeader>

                {syncStatus === 'idle' && (
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <div className="p-4 border rounded-lg space-y-3">
                                <div className="flex items-start gap-3">
                                    <CloudUpload className="w-5 h-5 text-blue-500 mt-0.5" />
                                    <div className="flex-1 space-y-1">
                                        <h3 className="font-medium">Upload Progress</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Upload your local progress to the server
                                        </p>
                                    </div>
                                </div>
                                <Alert className="border-orange-200 bg-orange-50">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    <AlertDescription className="text-orange-800">
                                        <strong>Warning:</strong> This will overwrite all progress on the server with your local data.
                                    </AlertDescription>
                                </Alert>
                                <Button 
                                    onClick={handleUpload}
                                    className="w-full"
                                    variant="default"
                                >
                                    <CloudUpload className="w-4 h-4 mr-2" />
                                    Upload to Server
                                </Button>
                            </div>

                            <div className="p-4 border rounded-lg space-y-3">
                                <div className="flex items-start gap-3">
                                    <CloudDownload className="w-5 h-5 text-green-500 mt-0.5" />
                                    <div className="flex-1 space-y-1">
                                        <h3 className="font-medium">Download Progress</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Download progress from the server
                                        </p>
                                    </div>
                                </div>
                                <Alert className="border-orange-200 bg-orange-50">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    <AlertDescription className="text-orange-800">
                                        <strong>Warning:</strong> This will replace all your local progress with data from the server.
                                    </AlertDescription>
                                </Alert>
                                <Button 
                                    onClick={handleDownload}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    <CloudDownload className="w-4 h-4 mr-2" />
                                    Download from Server
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {(syncStatus === 'uploading' || syncStatus === 'downloading') && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-center">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                        <div className="space-y-2">
                            <Progress value={progress} className="h-2" />
                            <p className="text-sm text-center text-muted-foreground">
                                {message}
                            </p>
                        </div>
                    </div>
                )}

                {syncStatus === 'success' && (
                    <div className="space-y-4 py-4">
                        <div className="flex flex-col items-center gap-3">
                            <CheckCircle className="w-12 h-12 text-green-500" />
                            <p className="text-center">{message}</p>
                        </div>
                    </div>
                )}

                {syncStatus === 'error' && (
                    <div className="space-y-4 py-4">
                        <div className="flex flex-col items-center gap-3">
                            <XCircle className="w-12 h-12 text-red-500" />
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                            <Button 
                                onClick={resetDialog}
                                variant="outline"
                                className="w-full"
                            >
                                Try Again
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}