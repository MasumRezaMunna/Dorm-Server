import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import logger from '../utils/logger.js';

/**
 * Initialize Firebase Admin SDK using service account credentials
 * from environment variables (never commit actual credentials)
 */
const initFirebaseAdmin = () => {
  try {
    if (getApps().length > 0) return; // Prevent re-initialization

    if (!process.env.FIREBASE_PROJECT_ID) {
      logger.warn('⚠️ Firebase Admin SDK not initialized: Missing FIREBASE_PROJECT_ID in .env');
      return;
    }

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines in private key (common .env parsing issue)
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });

    logger.info('✅ Firebase Admin SDK initialized');
  } catch (error) {
    logger.error(`Firebase Admin initialization failed: ${error.message}`);
    throw error;
  }
};

initFirebaseAdmin();

let authInstance;
try {
  authInstance = getApps().length > 0 ? getAuth() : {
    verifyIdToken: () => {
      throw new Error("Firebase Admin SDK is not initialized. Please configure .env.");
    }
  };
} catch (e) {
  authInstance = {
    verifyIdToken: () => {
      throw new Error("Firebase Admin SDK is not initialized. Please configure .env.");
    }
  };
}

export const auth = authInstance;
