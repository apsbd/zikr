'use client';

import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogOut, User, ChevronDown, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import UserSettings from './UserSettings';

export default function UserProfile() {
    const { user, signOut } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleSignOut = async () => {
        try {
            setIsDropdownOpen(false); // Close dropdown on sign out
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    return (
        <>
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
                        <ThemeToggle />

                        {/* Desktop user info */}
                        <div className='hidden sm:flex items-center gap-2 text-sm'>
                            <User className='w-4 h-4 text-muted-foreground' />
                            <span className='text-muted-foreground'>
                                {user.email}
                            </span>
                        </div>

                        {/* Mobile user dropdown */}
                        <div
                            className='flex sm:hidden relative'
                            ref={dropdownRef}>
                            <button
                                onClick={() =>
                                    setIsDropdownOpen(!isDropdownOpen)
                                }
                                className='flex items-center gap-1 p-2 rounded-md hover:bg-accent transition-colors'>
                                <User className='w-4 h-4 text-muted-foreground' />
                                <ChevronDown
                                    className={`w-3 h-3 text-muted-foreground transition-transform ${
                                        isDropdownOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>

                            {/* Dropdown content */}
                            {isDropdownOpen && (
                                <div className='absolute right-0 top-full mt-2 w-64 bg-background border border-border rounded-lg shadow-lg p-3 z-50'>
                                    <div className='text-sm mb-3'>
                                        <p className='text-muted-foreground mb-1'>
                                            Signed in as:
                                        </p>
                                        <p className='font-medium text-foreground break-all'>
                                            {user.email}
                                        </p>
                                    </div>

                                    {/* Settings button in dropdown */}
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => {
                                            setShowSettings(true);
                                            setIsDropdownOpen(false);
                                        }}
                                        className='w-full flex items-center gap-2 justify-start mb-2'>
                                        <Settings className='w-4 h-4' />
                                        Settings
                                    </Button>

                                    {/* Sign out button in dropdown */}
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleSignOut}
                                        className='w-full flex items-center gap-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10'>
                                        <LogOut className='w-4 h-4' />
                                        Sign Out
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Desktop settings button */}
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setShowSettings(true)}
                            className='hidden sm:flex items-center gap-2'>
                            <Settings className='w-4 h-4' />
                            Settings
                        </Button>

                        {/* Desktop sign out button */}
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={handleSignOut}
                            className='hidden sm:flex items-center gap-2'>
                            <LogOut className='w-4 h-4' />
                            Sign Out
                        </Button>
                    </div>
                </div>
            </div>
        </header>
        
        {/* Settings Modal */}
        {showSettings && (
            <UserSettings onClose={() => setShowSettings(false)} />
        )}
        </>
    );
}
