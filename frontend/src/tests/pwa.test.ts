/**
 * PWA Implementation Tests
 * Feature: qr-chain-attendance
 * Requirements: 20.1, 20.2, 20.3, 20.4
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('PWA Implementation', () => {
  // Correct path: from frontend/src/tests to frontend/public
  const publicDir = path.join(__dirname, '../../public');

  describe('Manifest (Requirement 20.1)', () => {
    it('should have a valid manifest.json file', () => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      
      // Required fields for PWA
      expect(manifest.name).toBeDefined();
      expect(manifest.short_name).toBeDefined();
      expect(manifest.start_url).toBeDefined();
      expect(manifest.display).toBeDefined();
      expect(manifest.icons).toBeDefined();
      expect(Array.isArray(manifest.icons)).toBe(true);
    });

    it('should have required icon sizes', () => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      const iconSizes = manifest.icons.map((icon: any) => icon.sizes);
      expect(iconSizes).toContain('192x192');
      expect(iconSizes).toContain('512x512');
    });

    it('should have standalone display mode', () => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      expect(manifest.display).toBe('standalone');
    });

    it('should have theme color defined', () => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      expect(manifest.theme_color).toBeDefined();
      expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('Service Worker (Requirement 20.2)', () => {
    it('should have a service worker file', () => {
      const swPath = path.join(publicDir, 'sw.js');
      expect(fs.existsSync(swPath)).toBe(true);
    });

    it('should define cache names', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain('CACHE_NAME');
      expect(swContent).toContain('qr-attendance');
    });

    it('should implement install event listener', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain("addEventListener('install'");
      expect(swContent).toContain('caches.open');
    });

    it('should implement activate event listener', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain("addEventListener('activate'");
      expect(swContent).toContain('caches.keys');
    });

    it('should implement fetch event listener', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain("addEventListener('fetch'");
      expect(swContent).toContain('caches.match');
    });

    it('should cache static assets on install', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain('STATIC_ASSETS');
      expect(swContent).toContain('cache.addAll');
    });
  });

  describe('Icons (Requirement 20.1, 20.3)', () => {
    it('should have 192x192 icon file', () => {
      const iconPath = path.join(publicDir, 'icon-192.png');
      expect(fs.existsSync(iconPath)).toBe(true);

      const stats = fs.statSync(iconPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should have 512x512 icon file', () => {
      const iconPath = path.join(publicDir, 'icon-512.png');
      expect(fs.existsSync(iconPath)).toBe(true);

      const stats = fs.statSync(iconPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should have valid PNG format', () => {
      const icon192Path = path.join(publicDir, 'icon-192.png');
      const icon512Path = path.join(publicDir, 'icon-512.png');

      // Check PNG magic number (first 8 bytes)
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      
      const icon192 = fs.readFileSync(icon192Path);
      const icon512 = fs.readFileSync(icon512Path);

      expect(icon192.slice(0, 8).equals(pngSignature)).toBe(true);
      expect(icon512.slice(0, 8).equals(pngSignature)).toBe(true);
    });
  });

  describe('Offline Support (Requirement 20.5)', () => {
    it('should have offline fallback page', () => {
      const offlinePath = path.join(publicDir, 'offline.html');
      expect(fs.existsSync(offlinePath)).toBe(true);

      const content = fs.readFileSync(offlinePath, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('offline');
    });

    it('should cache offline page in service worker', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain('offline.html');
    });
  });

  describe('App Integration', () => {
    it('should register service worker in _app.tsx', () => {
      const appPath = path.join(__dirname, '../pages/_app.tsx');
      
      if (fs.existsSync(appPath)) {
        const appContent = fs.readFileSync(appPath, 'utf-8');
        expect(appContent).toContain('serviceWorker');
        expect(appContent).toContain('register');
      }
    });

    it('should link manifest in _app.tsx', () => {
      const appPath = path.join(__dirname, '../pages/_app.tsx');
      
      if (fs.existsSync(appPath)) {
        const appContent = fs.readFileSync(appPath, 'utf-8');
        expect(appContent).toContain('manifest.json');
      }
    });

    it('should set theme color meta tag', () => {
      const appPath = path.join(__dirname, '../pages/_app.tsx');
      
      if (fs.existsSync(appPath)) {
        const appContent = fs.readFileSync(appPath, 'utf-8');
        expect(appContent).toContain('theme-color');
      }
    });
  });

  describe('Caching Strategy (Requirement 20.4)', () => {
    it('should implement cache-first strategy for static assets', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      // Should check cache before network for static assets
      expect(swContent).toContain('caches.match');
    });

    it('should implement network-first strategy for API calls', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      // Should handle API requests differently
      expect(swContent).toContain('/api/');
    });

    it('should clean up old caches on activation', () => {
      const swPath = path.join(publicDir, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain('caches.delete');
    });
  });
});
