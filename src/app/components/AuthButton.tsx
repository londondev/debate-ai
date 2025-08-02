"use client";

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth, googleProvider, db } from "@/app/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      console.log("User signed in:", user.displayName);

      // Check if user exists in Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Create new user in Firestore
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          debatesWon: 0,
          debatesLost: 0,
          totalDebates: 0,
          freeDebatesUsed: 0,
          isPremium: false,
        });
        console.log("✅ New user created in Firestore");
      } else {
        console.log("✅ User already exists in Firestore");
      }
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("User signed out");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4 border rounded-lg">
      {user ? (
        <div className="flex items-center gap-4">
          <img
            src={user.photoURL || ""}
            alt={user.displayName || "User"}
            className="w-10 h-10 rounded-full"
          />
          <div>
            <p className="font-semibold">{user.displayName}</p>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          onClick={handleSignIn}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      )}
    </div>
  );
}
