/**
 * Next.js App Component
 * Feature: qr-chain-attendance
 * Requirements: 20.1, 20.2, 20.3, 20.5
 */

import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import OfflineIndicator from '../components/OfflineIndicator';
import { useOnlineStatusCallback } from '../hooks/useOnlineStatus';
import { globalOfflineQueue } from '../utils/offlineQueue';

export default function App({ Component, pageProps }: AppProps) {
  // Monitor online status and retry queued operations when connection restored
  useOnlineStatusCallback((isOnline) => {
    if (isOnline) {
      console.log('[App] Connection restored, retrying queued operations');
      globalOfflineQueue.retryAll();
    }
  });
  useEffect(() => {
    // Register service worker for PWA (Requirement 20.1, 20.2)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered successfully:', registration.scope);
            
            // Check for updates periodically
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New service worker available. Refresh to update.');
                    // Optionally show update notification to user
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error);
          });
      });
    } else {
      console.warn('[PWA] Service Workers are not supported in this browser');
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#0078d4" />
        <meta name="description" content="QR Chain Attendance System - Anti-cheat classroom attendance with peer-to-peer verification" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="QR Attend" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <title>QR Chain Attendance</title>
      </Head>
      
      {/* Offline indicator - Requirement 20.5 */}
      <OfflineIndicator position="top" />
      
      <Component {...pageProps} />
    </>
  );
}
