const CACHE_NAME = 'band-manager-v1';
const urlsToCache = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json'
];

// Assets críticos para funcionalidad offline
const CRITICAL_CACHE = [
  '/',
  '/login',
  '/register'
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching critical files');
        return cache.addAll(CRITICAL_CACHE.map(url => new Request(url, { credentials: 'same-origin' })));
      })
      .catch((error) => {
        console.error('Service Worker: Error during installation', error);
      })
  );
  
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the response for future use
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.log('Service Worker: Network failed, trying cache', error);
            
            // If it's a navigation request and we're offline, serve the offline page
            if (event.request.destination === 'document') {
              return caches.match('/') || createOfflinePage();
            }
            
            // For other requests, you might want to return a default offline asset
            throw error;
          });
      })
  );
});

// Create a simple offline page
function createOfflinePage() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Band Manager - Sin conexión</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          background-color: #f3f4f6;
          color: #374151;
        }
        .offline-container {
          text-align: center;
          max-width: 400px;
          padding: 2rem;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 {
          margin: 0 0 1rem 0;
          color: #4f46e5;
        }
        p {
          margin: 0 0 2rem 0;
          line-height: 1.6;
        }
        .retry-btn {
          background-color: #4f46e5;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
        }
        .retry-btn:hover {
          background-color: #4338ca;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">🎵</div>
        <h1>Sin Conexión</h1>
        <p>No se puede conectar a Internet. Algunas funciones pueden no estar disponibles.</p>
        <button class="retry-btn" onclick="window.location.reload()">
          Intentar de nuevo
        </button>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'send-notifications') {
    event.waitUntil(
      // Sync pending notifications when back online
      syncPendingNotifications()
    );
  }
});

async function syncPendingNotifications() {
  try {
    // This would sync with your notification service
    console.log('Service Worker: Syncing pending notifications');
    
    // Broadcast to all clients that we're back online
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACK_ONLINE',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Service Worker: Error syncing notifications', error);
  }
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received', event);
  
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [200, 100, 200],
      tag: 'band-notification',
      actions: [
        {
          action: 'view',
          title: 'Ver',
          icon: '/icons/icon-96x96.png'
        },
        {
          action: 'dismiss',
          title: 'Descartar'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification('Band Manager', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});