'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstaller() {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if running on iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(iOS);

        // Check if app is already installed
        const isStandalone = window.matchMedia(
            '(display-mode: standalone)'
        ).matches;
        const isInWebAppiOS = (window.navigator as any).standalone === true;
        const isInstalled = isStandalone || isInWebAppiOS;

        setIsInstalled(isInstalled);

        // Check if user has dismissed the prompt before
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            setIsDismissed(true);
        }

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                })
                .catch((registrationError) => {
                });
        }

        // Listen for the beforeinstallprompt event (works on Android Chrome, Edge, etc.)
        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!dismissed && !isInstalled) {
                setShowInstallButton(true);
            }
        };

        window.addEventListener(
            'beforeinstallprompt',
            handleBeforeInstallPrompt as EventListener
        );

        // Show install prompt for iOS users (since beforeinstallprompt doesn't work)
        if (iOS && !isInstalled && !dismissed) {
            setShowInstallButton(true);
        }

        return () => {
            window.removeEventListener(
                'beforeinstallprompt',
                handleBeforeInstallPrompt as EventListener
            );
        };
    }, []);

    const handleInstallClick = async () => {
        if (!isIOS && deferredPrompt) {
            // Android/Desktop install
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
            } else {
            }

            setDeferredPrompt(null);
            setShowInstallButton(false);
        }
    };

    const handleDismiss = () => {
        setShowInstallButton(false);
        setIsDismissed(true);
        localStorage.setItem('pwa-install-dismissed', 'true');
    };

    // Don't show if installed, dismissed, or on landing page
    if (isInstalled || isDismissed || !showInstallButton) return null;

    return (
        <div className='fixed bottom-4 right-4 z-50 max-w-sm'>
            <Card className='p-4 shadow-lg border-2 border-primary/20 bg-background/95 backdrop-blur-sm'>
                <div className='flex items-start gap-3'>
                    <div className='flex-shrink-0'>
                        <div className='w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center'>
                            <svg
                                className='w-4 h-4 text-primary'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M12 4v16m8-8H4'
                                />
                            </svg>
                        </div>
                    </div>

                    <div className='flex-1 min-w-0'>
                        <h3 className='font-semibold text-sm text-foreground mb-1'>
                            Install Zikr App
                        </h3>

                        {isIOS ? (
                            <p className='text-xs text-muted-foreground mb-3'>
                                Tap{' '}
                                <span className='inline-flex items-center gap-1'>
                                    <svg
                                        className='w-3 h-3'
                                        fill='currentColor'
                                        viewBox='0 0 24 24'>
                                        <path d='M12 4V1l4 4-4 4V6c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2c0 3.31-2.69 6-6 6s-6-2.69-6-6z' />
                                    </svg>
                                    Share
                                </span>{' '}
                                then "Add to Home Screen"
                            </p>
                        ) : (
                            <p className='text-xs text-muted-foreground mb-3'>
                                Get the full app experience with offline access
                            </p>
                        )}

                        <div className='flex gap-2'>
                            {!isIOS && (
                                <Button
                                    onClick={handleInstallClick}
                                    size='sm'
                                    className='text-xs h-8'
                                    disabled={!deferredPrompt}>
                                    Install
                                </Button>
                            )}

                            <Button
                                onClick={handleDismiss}
                                variant='outline'
                                size='sm'
                                className='text-xs h-8'>
                                {isIOS ? 'Got it' : 'Later'}
                            </Button>
                        </div>
                    </div>

                    <Button
                        onClick={handleDismiss}
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 p-0 hover:bg-muted/50'>
                        <svg
                            className='w-3 h-3'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'>
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M6 18L18 6M6 6l12 12'
                            />
                        </svg>
                    </Button>
                </div>
            </Card>
        </div>
    );
}
