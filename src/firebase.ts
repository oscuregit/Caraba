import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Helper to clean quotes and whitespace from configuration values.
// This is critical because some environments or .env parsers preserve literal quotes,
// which causes Firebase initialization to fail with invalid-api-key or other auth errors.
function cleanValue(val: any): string | undefined {
  if (typeof val !== 'string') return val;
  const cleaned = val.replace(/^["']|["']$/g, '').trim();
  return cleaned || undefined;
}

// Robustly load the local Firebase applet configuration if present using import.meta.glob.
// This prevents compilation errors if the file is missing/ignored on external environments (like GitHub).
const configs = import.meta.glob('../firebase-applet-config.json', { eager: true });
const configKey = Object.keys(configs).find(key => key.endsWith('firebase-applet-config.json'));
const appletConfig = configKey ? (configs[configKey] as any)?.default || {} : {};

// Combine environment variables and local JSON configuration file.
// Environment variables take precedence.
const firebaseConfig = {
  apiKey: cleanValue(import.meta.env.VITE_FIREBASE_API_KEY) || cleanValue(appletConfig.apiKey),
  authDomain: cleanValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || cleanValue(appletConfig.authDomain),
  projectId: cleanValue(import.meta.env.VITE_FIREBASE_PROJECT_ID) || cleanValue(appletConfig.projectId),
  storageBucket: cleanValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || cleanValue(appletConfig.storageBucket),
  messagingSenderId: cleanValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || cleanValue(appletConfig.messagingSenderId),
  appId: cleanValue(import.meta.env.VITE_FIREBASE_APP_ID) || cleanValue(appletConfig.appId),
  firestoreDatabaseId: cleanValue(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID) || cleanValue(appletConfig.firestoreDatabaseId)
};

// Log Firebase Init diagnostics for debugging
console.log('[Firebase Init Diagnostics]', {
  hasApiKey: !!firebaseConfig.apiKey,
  apiKeyLength: firebaseConfig.apiKey ? firebaseConfig.apiKey.length : 0,
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
  resolvedGlobKeys: Object.keys(configs),
});

let app: any = null;
let db: any = null;
let auth: any = null;
let initError: Error | null = null;

const hasValidConfig = firebaseConfig.apiKey && 
  !firebaseConfig.apiKey.includes('YOUR_API_KEY') && 
  firebaseConfig.apiKey.trim().length > 10;

if (!hasValidConfig) {
  initError = new Error('Firebase API Key is invalid or missing.');
  // Fallback to safe placeholder values so SDK functions do not crash with TypeErrors on startup
  firebaseConfig.apiKey = "AIzaSyFakeKeyPlaceholder1234567890";
  if (!firebaseConfig.projectId) firebaseConfig.projectId = "placeholder-project";
  if (!firebaseConfig.authDomain) firebaseConfig.authDomain = "placeholder-project.firebaseapp.com";
}

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
  auth = getAuth(app);
} catch (error) {
  console.error('[Firebase Init Error]', error);
  initError = error instanceof Error ? error : new Error(String(error));
}

export { app, db, auth, initError };

// Validate connection as requested by Firebase skill
async function testConnection() {
  if (initError || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore: Client is offline or network is disconnected.");
    }
  }
}
testConnection();
