'use client';

import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogOut, User } from 'lucide-react';

export default function UserProfile() {
    const { user, signOut } = useAuth();

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (!user) return null;

    return (
        <header className='w-full bg-background border-b border-border/50'>
            <div className='max-w-7xl mx-auto px-4 py-4'>
                <div className='flex items-center justify-between'>
                    {/* Left side - Zikr branding */}
                    <div className='flex items-center'>
                        <div className='text-left'>
                            <h1 className='text-2xl font-bold text-foreground tracking-tight'>
                                Zikr
                            </h1>
                            <p className='text-sm text-muted-foreground -mt-1'>
                                Learn Arabic through spaced repetition
                            </p>
                        </div>
                    </div>

                    {/* Right side - User info and controls */}
                    <div className='flex items-center gap-4'>
                        <div className='hidden sm:flex items-center gap-2 text-sm'>
                            <User className='w-4 h-4 text-muted-foreground' />
                            <span className='text-muted-foreground'>
                                {user.email}
                            </span>
                        </div>

                        <div className='flex items-center gap-2'>
                            <ThemeToggle />
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={handleSignOut}
                                className='flex items-center gap-2'>
                                <LogOut className='w-4 h-4' />
                                <span className='hidden sm:inline'>
                                    Sign Out
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
