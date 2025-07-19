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
        
        // Starting upload sync
        setSyncStatus('uploading');
        setProgress(0);
        setError(null);
        setMessage('Preparing to upload your progress...');

        try {
            // Ensure offline service is initialized
            await offlineService.init();
            
            setProgress(20);
            setMessage('Uploading your progress to the server...');
            
            // Perform upload sync (local → server) with progress callback
            const result = await offlineService.performManualUpload(user.id, (progress, message) => {
                setProgress(progress);
                setMessage(message);
            });
            
            setProgress(100);
            
            if (result.success) {
                setSyncStatus('success');
                setMessage(`✅ Successfully synced! Uploaded ${result.synced_count} items to the server.`);
            } else {
                throw new Error('Upload failed');
            }
            
            // Wait longer before closing to show success message
            setTimeout(() => {
                onSyncComplete?.();
                onOpenChange(false);
                setSyncStatus('idle');
                setProgress(0);
            }, 3500);
            
        } catch (err: any) {
            // Upload error occurred
            setSyncStatus('error');
            setError(err.message || 'Failed to upload progress. Please check your connection and try again.');
            setProgress(0);
        }
    };

    const handleDownload = async () => {
        if (!user) return;
        
        // Starting download sync
        setSyncStatus('downloading');
        setProgress(0);
        setError(null);
        setMessage('Preparing to download progress from server...');

        try {
            // Ensure offline service is initialized
            await offlineService.init();
            
            // Perform download sync (server → local) with progress callback
            const result = await offlineService.performManualDownload(user.id, (progress, message) => {
                setProgress(progress);
                setMessage(message);
            });
            
            setProgress(100);
            
            if (result.success) {
                setSyncStatus('success');
                const totalSynced = result.synced_count;
                setMessage(`✅ Successfully synced! Downloaded ${totalSynced} items from the server.`);
            } else {
                throw new Error('Download failed');
            }
            
            // Wait longer before closing to show success message
            setTimeout(() => {
                onSyncComplete?.();
                onOpenChange(false);
                setSyncStatus('idle');
                setProgress(0);
            }, 3500);
            
        } catch (err: any) {
            // Download error occurred
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
            <DialogContent className="max-w-md" showCloseButton={false}>
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Sync Your Data</DialogTitle>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            <span className="sr-only">Close</span>
                        </button>
                    </div>
                    <DialogDescription>
                        Keep your progress synchronized between devices
                    </DialogDescription>
                </DialogHeader>

                {syncStatus === 'idle' && (
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <div className="p-4 border rounded-lg space-y-3 hover:border-blue-200 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <CloudUpload className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <h3 className="font-medium">Upload to Cloud</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Save your local progress to the server
                                        </p>
                                    </div>
                                </div>
                                <Alert className="border-2 border-red-400 bg-red-50 shadow-md">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                    <AlertDescription className="text-sm font-medium text-red-900">
                                        This will replace server data with your local progress
                                    </AlertDescription>
                                </Alert>
                                <Button 
                                    onClick={handleUpload}
                                    className="w-full"
                                    variant="default"
                                >
                                    <CloudUpload className="w-4 h-4 mr-2" />
                                    Upload
                                </Button>
                            </div>

                            <div className="p-4 border rounded-lg space-y-3 hover:border-green-200 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-green-50 rounded-lg">
                                        <CloudDownload className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <h3 className="font-medium">Download from Cloud</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Get the latest progress from the server
                                        </p>
                                    </div>
                                </div>
                                <Alert className="border-2 border-red-400 bg-red-50 shadow-md">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                    <AlertDescription className="text-sm font-medium text-red-900">
                                        This will replace local data with your server progress
                                    </AlertDescription>
                                </Alert>
                                <Button 
                                    onClick={handleDownload}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    <CloudDownload className="w-4 h-4 mr-2" />
                                    Download
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {(syncStatus === 'uploading' || syncStatus === 'downloading') && (
                    <div className="space-y-6 py-6">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-gray-200 rounded-full" />
                                <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                            <h3 className="text-lg font-medium">
                                {syncStatus === 'uploading' ? 'Uploading to Server' : 'Downloading from Server'}
                            </h3>
                        </div>
                        <div className="space-y-3">
                            <Progress value={progress} className="h-3" />
                            <p className="text-sm text-center text-muted-foreground">
                                {message || 'Syncing your data...'}
                            </p>
                            <p className="text-xs text-center text-muted-foreground">
                                {progress}% complete
                            </p>
                        </div>
                    </div>
                )}

                {syncStatus === 'success' && (
                    <div className="space-y-6 py-6">
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-3 bg-green-100 rounded-full">
                                <CheckCircle className="w-16 h-16 text-green-600" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold text-green-900">Sync Complete!</h3>
                                <p className="text-base text-gray-700 font-medium px-4">{message}</p>
                            </div>
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