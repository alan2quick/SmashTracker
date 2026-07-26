// Firebase project used for publishing boards to public read-only links.
// Set this to null to turn publishing off and keep the app entirely local.
// Setup walkthrough and the matching database rules: see README.
//
// These values are not secrets; they identify the project and are meant to
// ship in client code. The data is protected by the database rules.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBznsomiq1Vk_My3noMl70dr1UUoovhL64",
  authDomain: "smashtracker-bc1e0.firebaseapp.com",
  databaseURL: "https://smashtracker-bc1e0-default-rtdb.firebaseio.com",
  projectId: "smashtracker-bc1e0",
  storageBucket: "smashtracker-bc1e0.firebasestorage.app",
  messagingSenderId: "48463648795",
  appId: "1:48463648795:web:a89655fb4f769aa4d900be",
};
