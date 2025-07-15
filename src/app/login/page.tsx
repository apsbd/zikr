'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { useEffect } from 'react';
import AuthForm from '@/components/Auth/AuthForm';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    // Redirect to home if already authenticated
    useEffect(() => {
        if (user && !loading) {
            router.push('/');
        }
    }, [user, loading, router]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <div className='text-center'>
                    <div className='w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
                    <p className='text-muted-foreground'>Loading...</p>
                </div>
            </div>
        );
    }

    // Don't show login form if user is authenticated
    if (user) {
        return null;
    }

    return (
        <div className='min-h-screen bg-background'>
            {/* Back button */}
            <div className='absolute top-4 left-4 z-10'>
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => router.push('/')}
                    className='text-muted-foreground hover:text-foreground'>
                    <svg
                        className='w-4 h-4 mr-2'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'>
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M10 19l-7-7m0 0l7-7m-7 7h18'
                        />
                    </svg>
                    Back to Home
                </Button>
            </div>

            <AuthForm />
        </div>
    );
}
