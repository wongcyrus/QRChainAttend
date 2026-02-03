/**
 * Tests for Azure Static Web App Configuration
 * 
 * These tests verify that the staticwebapp.config.json file is valid
 * and contains the required configuration for role-based access control
 * and authentication with Microsoft Entra ID.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('staticwebapp.config.json', () => {
  let config: any;

  beforeAll(() => {
    const configPath = path.join(__dirname, '..', '..', '..', 'staticwebapp.config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
  });

  describe('Configuration Structure', () => {
    test('should be valid JSON', () => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('should have routes array', () => {
      expect(config.routes).toBeDefined();
      expect(Array.isArray(config.routes)).toBe(true);
      expect(config.routes.length).toBeGreaterThan(0);
    });

    test('should have auth configuration', () => {
      expect(config.auth).toBeDefined();
      expect(config.auth.identityProviders).toBeDefined();
      expect(config.auth.identityProviders.azureActiveDirectory).toBeDefined();
    });

    test('should have navigationFallback', () => {
      expect(config.navigationFallback).toBeDefined();
      expect(config.navigationFallback.rewrite).toBe('/index.html');
    });

    test('should have responseOverrides', () => {
      expect(config.responseOverrides).toBeDefined();
      expect(config.responseOverrides['401']).toBeDefined();
      expect(config.responseOverrides['403']).toBeDefined();
      expect(config.responseOverrides['404']).toBeDefined();
    });

    test('should have globalHeaders', () => {
      expect(config.globalHeaders).toBeDefined();
      expect(config.globalHeaders['content-security-policy']).toBeDefined();
    });

    test('should have platform configuration', () => {
      expect(config.platform).toBeDefined();
      expect(config.platform.apiRuntime).toBe('node:22');
    });
  });

  describe('Authentication Configuration (Requirement 1.5)', () => {
    test('should configure Azure Active Directory provider', () => {
      const aad = config.auth.identityProviders.azureActiveDirectory;
      expect(aad).toBeDefined();
      expect(aad.registration).toBeDefined();
      expect(aad.registration.openIdIssuer).toContain('login.microsoftonline.com');
      expect(aad.registration.clientIdSettingName).toBe('AAD_CLIENT_ID');
      expect(aad.registration.clientSecretSettingName).toBe('AAD_CLIENT_SECRET');
    });

    test('should configure login parameters', () => {
      const aad = config.auth.identityProviders.azureActiveDirectory;
      expect(aad.login).toBeDefined();
      expect(aad.login.loginParameters).toContain('scope=openid profile email');
    });

    test('should redirect unauthorized users to AAD login', () => {
      expect(config.responseOverrides['401'].redirect).toBe('/.auth/login/aad');
      expect(config.responseOverrides['401'].statusCode).toBe(302);
    });
  });

  describe('Teacher-Only Routes (Requirement 1.3)', () => {
    const teacherRoutes = [
      { route: '/api/sessions', methods: ['POST'] },
      { route: '/api/sessions/*/seed-entry', methods: ['POST'] },
      { route: '/api/sessions/*/reseed-entry', methods: ['POST'] },
      { route: '/api/sessions/*/end', methods: ['POST'] },
      { route: '/api/sessions/*/start-exit-chain', methods: ['POST'] },
      { route: '/api/sessions/*/reseed-exit', methods: ['POST'] },
      { route: '/api/sessions/*/start-early-leave', methods: ['POST'] },
      { route: '/api/sessions/*/stop-early-leave', methods: ['POST'] },
      { route: '/api/sessions/*/late-qr', methods: ['GET'] },
      { route: '/api/sessions/*/early-qr', methods: ['GET'] },
      { route: '/api/sessions/*/attendance', methods: ['GET'] },
      { route: '/api/sessions/*/dashboard/negotiate', methods: ['POST'] },
      { route: '/api/sessions/*', methods: ['GET'] },
      { route: '/api/ai/session-summary', methods: ['POST'] },
      { route: '/api/ai/stall-advice', methods: ['POST'] },
    ];

    teacherRoutes.forEach(({ route, methods }) => {
      test(`should restrict ${methods.join(',')} ${route} to teacher role`, () => {
        const routeConfig = config.routes.find(
          (r: any) => r.route === route && 
          (!r.methods || methods.every((m: string) => r.methods.includes(m)))
        );
        
        expect(routeConfig).toBeDefined();
        expect(routeConfig.allowedRoles).toContain('teacher');
      });
    });

    test('should have teacher routes before catch-all route', () => {
      const catchAllIndex = config.routes.findIndex((r: any) => r.route === '/api/*');
      const teacherRouteIndices = teacherRoutes.map(({ route }) =>
        config.routes.findIndex((r: any) => r.route === route)
      );

      teacherRouteIndices.forEach(index => {
        expect(index).toBeLessThan(catchAllIndex);
      });
    });
  });

  describe('Student-Only Routes (Requirement 1.4)', () => {
    const studentRoutes = [
      { route: '/api/scan/chain', methods: ['POST'] },
      { route: '/api/scan/late-entry', methods: ['POST'] },
      { route: '/api/scan/early-leave', methods: ['POST'] },
      { route: '/api/scan/exit-chain', methods: ['POST'] },
      { route: '/api/sessions/*/join', methods: ['POST'] },
    ];

    studentRoutes.forEach(({ route, methods }) => {
      test(`should restrict ${methods.join(',')} ${route} to student role`, () => {
        const routeConfig = config.routes.find(
          (r: any) => r.route === route && 
          (!r.methods || methods.every((m: string) => r.methods.includes(m)))
        );
        
        expect(routeConfig).toBeDefined();
        expect(routeConfig.allowedRoles).toContain('student');
      });
    });

    test('should have student routes before catch-all route', () => {
      const catchAllIndex = config.routes.findIndex((r: any) => r.route === '/api/*');
      const studentRouteIndices = studentRoutes.map(({ route }) =>
        config.routes.findIndex((r: any) => r.route === route)
      );

      studentRouteIndices.forEach(index => {
        expect(index).toBeLessThan(catchAllIndex);
      });
    });
  });

  describe('Security Headers', () => {
    test('should have Content Security Policy', () => {
      const csp = config.globalHeaders['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain('default-src');
      expect(csp).toContain('script-src');
      expect(csp).toContain('connect-src');
    });

    test('should allow SignalR connections in CSP', () => {
      const csp = config.globalHeaders['content-security-policy'];
      expect(csp).toContain('*.signalr.net');
      expect(csp).toContain('*.service.signalr.net');
    });

    test('should allow Azure Table Storage connections in CSP', () => {
      const csp = config.globalHeaders['content-security-policy'];
      expect(csp).toContain('*.table.core.windows.net');
    });

    test('should allow Microsoft login in CSP', () => {
      const csp = config.globalHeaders['content-security-policy'];
      expect(csp).toContain('login.microsoftonline.com');
    });

    test('should have X-Content-Type-Options header', () => {
      expect(config.globalHeaders['X-Content-Type-Options']).toBe('nosniff');
    });

    test('should have X-Frame-Options header', () => {
      expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
    });

    test('should have X-XSS-Protection header', () => {
      expect(config.globalHeaders['X-XSS-Protection']).toBe('1; mode=block');
    });

    test('should have Referrer-Policy header', () => {
      expect(config.globalHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    test('should have Permissions-Policy header', () => {
      const policy = config.globalHeaders['Permissions-Policy'];
      expect(policy).toBeDefined();
      expect(policy).toContain('camera=(self)');
      expect(policy).toContain('geolocation=(self)');
    });
  });

  describe('API Proxy Configuration', () => {
    test('should have catch-all API route', () => {
      const apiRoute = config.routes.find((r: any) => r.route === '/api/*');
      expect(apiRoute).toBeDefined();
      expect(apiRoute.allowedRoles).toContain('authenticated');
    });

    test('should exclude API routes from navigation fallback', () => {
      expect(config.navigationFallback.exclude).toContain('/api/*');
    });
  });

  describe('MIME Types', () => {
    test('should define common MIME types', () => {
      expect(config.mimeTypes['.json']).toBe('application/json');
      expect(config.mimeTypes['.js']).toBe('text/javascript');
      expect(config.mimeTypes['.css']).toBe('text/css');
      expect(config.mimeTypes['.svg']).toBe('image/svg+xml');
    });

    test('should define font MIME types', () => {
      expect(config.mimeTypes['.woff']).toBe('font/woff');
      expect(config.mimeTypes['.woff2']).toBe('font/woff2');
      expect(config.mimeTypes['.ttf']).toBe('font/ttf');
    });
  });

  describe('Error Pages', () => {
    test('should have 403 error page configuration', () => {
      expect(config.responseOverrides['403']).toBeDefined();
      expect(config.responseOverrides['403'].statusCode).toBe(403);
      expect(config.responseOverrides['403'].rewrite).toBe('/403.html');
    });

    test('should have 404 error page configuration', () => {
      expect(config.responseOverrides['404']).toBeDefined();
      expect(config.responseOverrides['404'].statusCode).toBe(404);
      expect(config.responseOverrides['404'].rewrite).toBe('/404.html');
    });
  });

  describe('Route Ordering', () => {
    test('should have specific routes before wildcard routes', () => {
      const routes = config.routes;
      const catchAllIndex = routes.findIndex((r: any) => r.route === '/api/*');
      
      // Find all specific API routes (not wildcards)
      const specificApiRoutes = routes.filter((r: any, index: number) => 
        r.route.startsWith('/api/') && 
        !r.route.includes('*') &&
        index !== catchAllIndex
      );

      // All specific routes should come before the catch-all
      specificApiRoutes.forEach((route: any) => {
        const routeIndex = routes.indexOf(route);
        expect(routeIndex).toBeLessThan(catchAllIndex);
      });
    });

    test('should have method-specific routes before method-agnostic routes', () => {
      const sessionRoutes = config.routes.filter((r: any) => 
        r.route.startsWith('/api/sessions/')
      );

      const withMethods = sessionRoutes.filter((r: any) => r.methods);
      const withoutMethods = sessionRoutes.filter((r: any) => !r.methods);

      if (withMethods.length > 0 && withoutMethods.length > 0) {
        const lastWithMethodIndex = config.routes.lastIndexOf(withMethods[withMethods.length - 1]);
        const firstWithoutMethodIndex = config.routes.indexOf(withoutMethods[0]);
        
        expect(lastWithMethodIndex).toBeLessThan(firstWithoutMethodIndex);
      }
    });
  });
});
