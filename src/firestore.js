import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
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