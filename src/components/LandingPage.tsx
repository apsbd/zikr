'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function LandingPage() {
    const router = useRouter();
    const { signIn } = useAuth();
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [canInstall, setCanInstall] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if running on iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(iOS);

        // Check if app is already installed
        const isStandalone = window.matchMedia(
            '(display-mode: standalone)'
        ).matches;
        const isInWebAppiOS = (window.navigator as any).standalone === true;

        if (isStandalone || isInWebAppiOS) {
            // If already installed, go directly to app
            handleUseWebVersion();
            return;
        }

        // Listen for install prompt
        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setCanInstall(true);
        };

        window.addEventListener(
            'beforeinstallprompt',
            handleBeforeInstallPrompt as EventListener
        );

        // Show install option for iOS users
        if (iOS) {
            setCanInstall(true);
        }

        return () => {
            window.removeEventListener(
                'beforeinstallprompt',
                handleBeforeInstallPrompt as EventListener
            );
        };
    }, []);

    const handleInstallApp = async () => {
        if (!isIOS && deferredPrompt) {
            // Android/Desktop install
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
                // After installation, proceed to the app
                setTimeout(() => handleUseWebVersion(), 1000);
            }
        } else if (isIOS) {
            // Show iOS install instructions
            alert(
                'To install this app on iOS:\n1. Tap the Share button\n2. Select "Add to Home Screen"'
            );
        }
    };

    const handleUseWebVersion = () => {
        // Navigate to the app (auth will be handled by ProtectedRoute)
        router.push('/');
    };

    return (
        <div className='min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col items-center justify-center p-4 relative overflow-hidden'>
            {/* Background decoration */}
            <div className='absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none' />
            <div className='absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl' />
            <div className='absolute bottom-20 right-10 w-96 h-96 bg-primary/3 rounded-full blur-3xl' />

            <div className='relative z-10 max-w-4xl mx-auto text-center'>
                {/* App Icon */}
                <div className='mb-8'>
                    <div className='w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-4'>
                        <svg
                            className='w-12 h-12 text-primary'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'>
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={1.5}
                                d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                            />
                        </svg>
                    </div>
                    <h1 className='text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'>
                        Zikr
                    </h1>
                    <p className='text-xl md:text-2xl text-muted-foreground mt-2'>
                        Learn Arabic through Spaced Repetition
                    </p>
                </div>

                {/* Features */}
                <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-12'>
                    <Card className='p-6 bg-card/50 backdrop-blur-sm border-border/50'>
                        <div className='w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4'>
                            <svg
                                className='w-6 h-6 text-primary'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                                />
                            </svg>
                        </div>
                        <h3 className='text-lg font-semibold mb-2'>
                            Smart Learning
                        </h3>
                        <p className='text-muted-foreground text-sm'>
                            AI-powered spaced repetition adapts to your learning
                            pace
                        </p>
                    </Card>

                    <Card className='p-6 bg-card/50 backdrop-blur-sm border-border/50'>
                        <div className='w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4'>
                            <svg
                                className='w-6 h-6 text-primary'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'
                                />
                            </svg>
                        </div>
                        <h3 className='text-lg font-semibold mb-2'>
                            Offline Ready
                        </h3>
                        <p className='text-muted-foreground text-sm'>
                            Study anywhere, anytime with offline support
                        </p>
                    </Card>

                    <Card className='p-6 bg-card/50 backdrop-blur-sm border-border/50'>
                        <div className='w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4'>
                            <svg
                                className='w-6 h-6 text-primary'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M13 10V3L4 14h7v7l9-11h-7z'
                                />
                            </svg>
                        </div>
                        <h3 className='text-lg font-semibold mb-2'>
                            Interactive
                        </h3>
                        <p className='text-muted-foreground text-sm'>
                            Engaging flashcards with Arabic text and audio
                        </p>
                    </Card>
                </div>

                {/* Call to Action */}
                <div className='space-y-6'>
                    <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
                        {canInstall && (
                            <Button
                                onClick={handleInstallApp}
                                size='lg'
                                className='px-8 py-6 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg transform hover:scale-105 transition-all duration-200'>
                                <svg
                                    className='w-5 h-5 mr-2'
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
                                Install App
                            </Button>
                        )}

                        <Button
                            onClick={handleUseWebVersion}
                            variant='outline'
                            size='lg'
                            className='px-8 py-6 text-lg font-semibold border-2 hover:bg-muted/50 transform hover:scale-105 transition-all duration-200'>
                            <svg
                                className='w-5 h-5 mr-2'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 0V3'
                                />
                            </svg>
                            Use Web Version
                        </Button>
                    </div>

                    {isIOS && canInstall && (
                        <p className='text-sm text-muted-foreground'>
                            📱 On iOS: Tap "Install App" for instructions, or
                            use the web version directly
                        </p>
                    )}
                </div>

                {/* Additional Info */}
                <div className='mt-16 text-center'>
                    <p className='text-muted-foreground text-sm'>
                        ✨ Free to use • 🔄 Sync across devices • 📚 Curated
                        content
                    </p>
                </div>
            </div>
        </div>
    );
}
