import { collection, addDoc, getDocs, onSnapshot, query, orderBy, limit, doc, updateDoc, deleteDoc, setDoc, getDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { db } from './firebase';

// Collection reference
const stallsCollection = collection(db, 'stalls');

// Generate email hash for rating document IDs (privacy-preserving, prevents gaming)
async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Add a new stall
export const addStall = async (stallData, userEmail) => {
  try {
    // Separate out the creator's rating before adding the stall
    const { rating: creatorRating, addedBy, ...restData } = stallData;

    // Add the stall document with initial aggregated rating
    const docRef = await addDoc(stallsCollection, {
      ...restData,
      addedBy,
      createdAt: new Date(),
      verified: false,
      ratingsCount: 1, // Creator's rating counts
      averageRating: creatorRating // Initially just the creator's rating
    });

    // Save creator's rating to the subcollection using email hash
    if (creatorRating && addedBy && userEmail) {
      const emailHash = await hashEmail(userEmail);
      const ratingRef = doc(db, 'stalls', docRef.id, 'ratings', emailHash);
      await setDoc(ratingRef, {
        rating: creatorRating,
        userId: addedBy,
        email: userEmail,
        createdAt: new Date()
      });
    }

    return { id: docRef.id, ...stallData, averageRating: creatorRating, ratingsCount: 1 };
  } catch (error) {
    console.error('Error adding stall:', error);
    throw error;
  }
};

// Get all stalls with real-time updates
export const subscribeToStalls = (callback) => {
  try {
    const q = query(stallsCollection, orderBy('createdAt', 'desc'), limit(100));

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const stalls = [];
      querySnapshot.forEach((doc) => {
        stalls.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(stalls);
    }, (error) => {
      console.error('Error listening to stalls:', error);
      callback([]);
    });

    return unsubscribe; // Return unsubscribe function for cleanup
  } catch (error) {
    console.error('Error setting up stalls listener:', error);
    return () => {}; // Return empty unsubscribe function
  }
};

// Update a stall
export async function updateStall(stallId, updates) {
  try {
    const stallRef = doc(db, 'stalls', stallId);
    await updateDoc(stallRef, {
      ...updates,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error updating stall:', error);
    throw error;
  }
}

// Delete a stall
export async function deleteStall(stallId) {
  try {
    const stallRef = doc(db, 'stalls', stallId);
    await deleteDoc(stallRef);
    return true;
  } catch (error) {
    console.error('Error deleting stall:', error);
    throw error;
  }
}

// Save a stall to user's favorites
export async function saveStall(userId, stallId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Create user doc if it doesn't exist
      await setDoc(userRef, {
        savedStalls: [stallId],
        createdAt: new Date()
      });
    } else {
      // Add to existing array
      await updateDoc(userRef, {
        savedStalls: arrayUnion(stallId)
      });
    }
    return true;
  } catch (error) {
    console.error('Error saving stall:', error);
    throw error;
  }
}

// Unsave a stall from user's favorites
export async function unsaveStall(userId, stallId) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      savedStalls: arrayRemove(stallId)
    });
    return true;
  } catch (error) {
    console.error('Error unsaving stall:', error);
    throw error;
  }
}

// Get user's saved stalls
export async function getSavedStalls(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return [];
    }

    return userDoc.data().savedStalls || [];
  } catch (error) {
    console.error('Error getting saved stalls:', error);
    return [];
  }
}

// Calculate and update aggregated rating for a stall
async function updateAggregatedRating(stallId) {
  try {
    // Get all ratings from subcollection
    const ratingsCollection = collection(db, 'stalls', stallId, 'ratings');
    const querySnapshot = await getDocs(ratingsCollection);

    const ratings = [];
    querySnapshot.forEach((doc) => {
      ratings.push(doc.data().rating);
    });

    const ratingsCount = ratings.length;

    if (ratingsCount === 0) {
      // No ratings, set defaults
      const stallRef = doc(db, 'stalls', stallId);
      await setDoc(stallRef, {
        averageRating: 0,
        ratingsCount: 0
      }, { merge: true });
      return { averageRating: 0, ratingsCount: 0 };
    }

    // Calculate average rating
    const sum = ratings.reduce((acc, rating) => acc + rating, 0);
    const averageRating = sum / ratingsCount;

    // Update the stall document (use setDoc with merge to create fields if they don't exist)
    const stallRef = doc(db, 'stalls', stallId);
    await setDoc(stallRef, {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      ratingsCount
    }, { merge: true });

    return { averageRating, ratingsCount };
  } catch (error) {
    console.error('Error updating aggregated rating:', error);
    throw error;
  }
}

// Submit or update a rating for a stall
export async function rateStall(stallId, userId, userEmail, rating) {
  try {
    const emailHash = await hashEmail(userEmail);
    const ratingRef = doc(db, 'stalls', stallId, 'ratings', emailHash);
    await setDoc(ratingRef, {
      rating,
      userId,
      email: userEmail,
      createdAt: new Date()
    });

    // Recalculate and update aggregated rating
    await updateAggregatedRating(stallId);

    return true;
  } catch (error) {
    console.error('Error rating stall:', error);
    throw error;
  }
}

// Get all ratings for a stall
export async function getStallRatings(stallId) {
  try {
    const ratingsCollection = collection(db, 'stalls', stallId, 'ratings');
    const querySnapshot = await getDocs(ratingsCollection);
    const ratings = [];
    querySnapshot.forEach((doc) => {
      ratings.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return ratings;
  } catch (error) {
    console.error('Error getting stall ratings:', error);
    return [];
  }
}

// Get user's rating for a stall (if any)
export async function getUserRating(stallId, userEmail) {
  try {
    const emailHash = await hashEmail(userEmail);
    const ratingRef = doc(db, 'stalls', stallId, 'ratings', emailHash);
    const ratingDoc = await getDoc(ratingRef);

    if (!ratingDoc.exists()) {
      return null;
    }

    return ratingDoc.data().rating;
  } catch (error) {
    console.error('Error getting user rating:', error);
    return null;
  }
}

// Silently track user activity
export async function trackUserActivity(email) {
  try {
    const betaUsersRef = collection(db, 'betaUsers');
    const q = query(betaUsersRef, where('email', '==', email));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const now = new Date();
      const userDoc = snapshot.docs[0];
      const data = userDoc.data();

      const updates = {
        lastActiveAt: now
      };

      // Only set firstActiveAt if it doesn't exist
      if (!data.firstActiveAt) {
        updates.firstActiveAt = now;
      }

      const userDocRef = doc(db, 'betaUsers', userDoc.id);
      await updateDoc(userDocRef, updates);

      console.log('✓ User login tracked:', email);
    } else {
      console.warn('⚠ User not found in betaUsers:', email);
    }
  } catch (error) {
    console.error('✗ Error tracking activity:', error);
  }
}

// Get all beta users for admin view
export async function getBetaUsers() {
  try {
    const betaUsersCollection = collection(db, 'betaUsers');
    const querySnapshot = await getDocs(betaUsersCollection);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({
        email: doc.id,
        ...doc.data()
      });
    });
    return users;
  } catch (error) {
    console.error('Error getting beta users:', error);
    return [];
  }
}

// Delete user account and anonymize their data (GDPR compliant)
export async function deleteUserAccount(userId, userEmail) {
  try {
    const emailHash = await hashEmail(userEmail);

    // 1. Delete user document
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);

    // 2. Anonymize all ratings by this user across all stalls
    const stallsSnapshot = await getDocs(stallsCollection);

    for (const stallDoc of stallsSnapshot.docs) {
      const ratingRef = doc(db, 'stalls', stallDoc.id, 'ratings', emailHash);
      const ratingDoc = await getDoc(ratingRef);

      if (ratingDoc.exists()) {
        // Anonymize the rating (remove PII but keep the rating value)
        await setDoc(ratingRef, {
          rating: ratingDoc.data().rating,
          userId: 'deleted-user',
          email: null,
          createdAt: ratingDoc.data().createdAt,
          deletedAt: new Date()
        });
      }
    }

    // 3. Mark user's stalls as community-owned (don't delete them)
    const userStallsQuery = query(stallsCollection, where('addedBy', '==', userId));
    const userStallsSnapshot = await getDocs(userStallsQuery);

    for (const stallDoc of userStallsSnapshot.docs) {
      await setDoc(doc(db, 'stalls', stallDoc.id), {
        addedBy: 'deleted-user'
      }, { merge: true });
    }

    console.log('✓ User account deleted and data anonymized');
    return { success: true };
  } catch (error) {
    console.error('Error deleting user account:', error);
    throw error;
  }
}