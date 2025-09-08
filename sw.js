// Development mode detection
const isDevelopment = self.location.hostname === 'localhost' || 
                     self.location.hostname === '127.0.0.1' || 
                     self.location.hostname.includes('local') ||
                     self.location.port === '3000' ||
                     self.location.port === '8080' ||
                     self.location.port === '5000';

// Use timestamp for cache name in development to force cache updates
const CACHE_NAME = isDevelopment ? 
  `yourgpt-dev-${Date.now()}` : 
  'yourgpt-v1.0.0';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

console.log(`Service Worker starting in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
console.log(`Cache name: ${CACHE_NAME}`);

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Add resources one by one to handle individual failures
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(error => {
              console.log(`Failed to cache ${url}:`, error);
              return null; // Continue with other resources
            })
          )
        );
      })
      .then((results) => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`Cache installation: ${successful} successful, ${failed} failed`);
      })
      .catch((error) => {
        console.log('Cache installation failed:', error);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and unsupported schemes
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension, chrome, and other unsupported schemes
  const url = new URL(event.request.url);
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'chrome:' || 
      url.protocol === 'moz-extension:' ||
      url.protocol === 'ms-browser-extension:') {
    return;
  }
  
  // Skip requests to external domains that we don't want to cache
  if (url.origin !== location.origin && 
      !url.hostname.includes('cdn.tailwindcss.com') &&
      !url.hostname.includes('cdn.jsdelivr.net') &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    (async () => {
      // In development mode, always fetch from network first
      if (isDevelopment) {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            console.log(`🔄 Dev mode: Fetched ${event.request.url} from network`);
            return networkResponse;
          }
        } catch (error) {
          console.log(`🌐 Dev mode: Network fetch failed for ${event.request.url}:`, error);
        }
      }
      
      // Try cache first (production mode or network failed in dev)
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse && !isDevelopment) {
        console.log(`📦 Cache hit: ${event.request.url}`);
        return cachedResponse;
      }
      
      // Fetch from network
      try {
        const networkResponse = await fetch(event.request);
        
        // Check if we received a valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Cache the response (but not in development mode for main files)
        if (!isDevelopment || !event.request.url.includes('index.html')) {
          const responseToCache = networkResponse.clone();
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, responseToCache);
            console.log(`💾 Cached: ${event.request.url}`);
          } catch (error) {
            console.log('Cache put failed:', error);
          }
        }
        
        return networkResponse;
      } catch (error) {
        console.log('Fetch failed:', error);
        
        // If both cache and network fail, show offline page
        if (event.request.destination === 'document') {
          const offlineResponse = await caches.match('/index.html');
          if (offlineResponse) {
            return offlineResponse;
          }
        }
        
        throw error;
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.allSettled(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then((results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`Cache cleanup: ${successful} successful, ${failed} failed`);
    }).catch((error) => {
      console.log('Cache cleanup failed:', error);
    })
  );
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    // Handle offline messages when connection is restored
  }
});

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1
        }
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'YourGPT', options)
          .catch((error) => {
            console.log('Notification failed:', error);
          })
      );
    } catch (error) {
      console.log('Push event data parsing failed:', error);
    }
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
      .catch((error) => {
        console.log('Failed to open window:', error);
      })
  );
});
