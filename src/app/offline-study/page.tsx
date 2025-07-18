'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfflineStudyPage() {
    const router = useRouter();
    
    useEffect(() => {
        // Get the intended study path from the URL or referrer
        const searchParams = new URLSearchParams(window.location.search);
        const studyPath = searchParams.get('path');
        
        if (studyPath) {
            // Try to navigate to the actual study page
            router.replace(studyPath);
        } else {
            // Try to get path from referrer or go to home
            const referrer = document.referrer;
            if (referrer && referrer.includes('/study/')) {
                const url = new URL(referrer);
                router.replace(url.pathname);
            } else {
                router.replace('/');
            }
        }
    }, [router]);
    
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h1 className="text-xl font-semibold mb-2">Loading Study Session...</h1>
                <p className="text-muted-foreground">Your study data is available offline</p>
            </div>
        </div>
    );
}