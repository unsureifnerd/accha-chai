import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc, setDoc, getDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { db } from './firebase';

// Collection reference
const stallsCollection = collection(db, 'stalls');

// Add a new stall
export const addStall = async (stallData) => {
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

    // Save creator's rating to the subcollection
    if (creatorRating && addedBy) {
      const ratingRef = doc(db, 'stalls', docRef.id, 'ratings', addedBy);
      await setDoc(ratingRef, {
        rating: creatorRating,
        userId: addedBy,
        createdAt: new Date()
      });
    }

    return { id: docRef.id, ...stallData, averageRating: creatorRating, ratingsCount: 1 };
  } catch (error) {
    console.error('Error adding stall:', error);
    throw error;
  }
};

// Get all stalls
export const getStalls = async () => {
  try {
    const q = query(stallsCollection, orderBy('createdAt', 'desc'), limit(100));
    const querySnapshot = await getDocs(q);
    const stalls = [];
    querySnapshot.forEach((doc) => {
      stalls.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return stalls;
  } catch (error) {
    console.error('Error getting stalls:', error);
    return [];
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
export async function rateStall(stallId, userId, rating) {
  try {
    const ratingRef = doc(db, 'stalls', stallId, 'ratings', userId);
    await setDoc(ratingRef, {
      rating,
      userId,
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
export async function getUserRating(stallId, userId) {
  try {
    const ratingRef = doc(db, 'stalls', stallId, 'ratings', userId);
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