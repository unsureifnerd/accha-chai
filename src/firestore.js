import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc, setDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase';

// Collection reference
const stallsCollection = collection(db, 'stalls');

// Add a new stall
export const addStall = async (stallData) => {
  try {
    const docRef = await addDoc(stallsCollection, {
      ...stallData,
      createdAt: new Date(),
      verified: false,
      ratingsCount: 0
    });
    return { id: docRef.id, ...stallData };
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