/**
 * Mobile OAuth Controller
 * 
 * Implements a server-side Google OAuth proxy for the mobile app.
 * This avoids the deprecated Expo auth proxy completely.
 *
 * Flow:
 *  1. App opens {SERVER}/api/auth/mobile/google in WebBrowser
 *  2. Server redirects to Google OAuth
 *  3. User signs in on Google
 *  4. Google redirects to {SERVER}/api/auth/mobile/google/callback
 *  5. Server exchanges code → Google access_token
 *  6. Server calls Firebase Auth REST API to get Firebase ID token
 *  7. Server verifies Firebase ID token, finds/creates user, issues JWT
 *  8. Server redirects to 467home://auth?token=JWT&user=...
 *  9. App receives deep link, extracts JWT, saves to store
 */
import { google } from 'googleapis';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import os from 'os';
import { auth } from '../config/firebase.js';
import User from '../models/user.model.js';

const APP_SCHEME = '467home';

/**
 * Auto-detects the server's local IPv4 address.
 * Falls back to SERVER_URL env var, then 'localhost'.
 */
const getLocalIp = () => {
  if (process.env.SERVER_URL) return process.env.SERVER_URL;
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return `http://${net.address}:${process.env.PORT || 5000}`;
      }
    }
  }
  return `http://localhost:${process.env.PORT || 5000}`;
};

const getCallbackUrl = () =>
  `${getLocalIp()}/api/auth/mobile/google/callback`;

const getOAuthClient = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getCallbackUrl()
  );

/**
 * GET /api/auth/mobile/google
 * Redirects the browser to Google's OAuth consent screen.
 */
export const mobileGoogleStart = (req, res) => {
  try {
    const authUrl = getOAuthClient().generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
      // Google requires these two parameters when redirecting to a private IP (e.g. 192.168.x.x)
      device_id: 'expo-dev-device',
      device_name: 'expo-dev-device',
    });
    res.redirect(authUrl);
  } catch (err) {
    console.error('[MobileAuth] Start error:', err.message);
    res.redirect(`${APP_SCHEME}://auth?error=${encodeURIComponent('Failed to start login')}`);
  }
};

/**
 * GET /api/auth/mobile/google/callback
 * Handles the Google OAuth callback, creates our JWT, redirects to the app.
 */
export const mobileGoogleCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${APP_SCHEME}://auth?error=cancelled`);
  }

  try {
    // 1. Exchange authorization code for Google access token
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // 2. Use Google access token to get a Firebase ID token via Firebase Auth REST API
    //    This properly creates/links the Firebase user with Google OAuth provider
    const firebaseRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        postBody: `access_token=${tokens.access_token}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnIdpCredential: true,
        returnSecureToken: true,
      }
    );

    const firebaseIdToken = firebaseRes.data.idToken;

    // 3. Verify Firebase ID token with Firebase Admin SDK
    const decoded = await auth.verifyIdToken(firebaseIdToken);
    const { uid, email, name, picture } = decoded;

    // 4. Find or create user in MongoDB
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email,
        displayName: name || email.split('@')[0],
        photoURL: picture || null,
        role: 'member',
      });
    }

    if (!user.isActive) {
      return res.redirect(`${APP_SCHEME}://auth?error=${encodeURIComponent('Account deactivated. Contact your manager.')}`);
    }

    // 5. Issue our own JWT (same as the web login flow) with long-lived default (30 days)
    const appToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    // 6. Redirect to the app's deep link with the token and user data
    const userPayload = encodeURIComponent(JSON.stringify({
      _id: user._id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: user.role,
      isActive: user.isActive,
    }));

    return res.redirect(`${APP_SCHEME}://auth?token=${appToken}&user=${userPayload}`);

  } catch (err) {
    console.error('[MobileAuth] Callback error:', err.response?.data || err.message);
    const msg = err.response?.data?.error?.message || err.message || 'Login failed';
    return res.redirect(`${APP_SCHEME}://auth?error=${encodeURIComponent(msg)}`);
  }
};
