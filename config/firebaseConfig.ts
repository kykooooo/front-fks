// config/firebaseConfig.ts
// L'apiKey est lue depuis les variables d'env (.env.local en dev, EAS secrets en prod).
// Les autres champs sont des identifiants publics non secrets (non confidentiels).
import Constants from 'expo-constants';

const apiKey =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
  (Constants.expoConfig?.extra?.FIREBASE_API_KEY as string | undefined) ??
  '';

export const firebaseWebConfig = {
  apiKey,
  authDomain: 'fks-apps.firebaseapp.com',
  projectId: 'fks-apps',
  storageBucket: 'fks-apps.appspot.com',
  messagingSenderId: '1045688248623',
  appId: '1:1045688248623:web:0659d25d6d96093f5019da',
};
