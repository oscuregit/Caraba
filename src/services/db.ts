import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  or,
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { db, auth } from '../firebase';
import { User, Trip, RouteStop, JoinRequest, LiveLocation, FinanceTransaction, RealtimeNotification, BuddyRequest } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || 'anonymous',
      email: auth.currentUser?.email || 'anonymous',
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ---------------- USER OPERATIONS ----------------

export async function registerNewUser(email: string, password: string, name: string) {
  const path = 'users';
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    const initials = name
      .split(' ')
      .map(part => part.slice(0, 1).toUpperCase())
      .join('')
      .slice(0, 2);

    const newUser: User = {
      uid: firebaseUser.uid,
      name,
      email,
      buddies: [],
      initials
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    return newUser;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loginUser(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    throw new Error('Kullanıcı dökümanı bulunamadı.');
  } catch (err) {
    throw err;
  }
}

export async function logOutUser() {
  await firebaseSignOut(auth);
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  try {
    const userCredential = await signInWithPopup(auth, provider);
    const firebaseUser = userCredential.user;
    
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      return userDocSnap.data() as User;
    }
    
    const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Kullanıcı';
    const initials = name
      .split(' ')
      .map(part => part.slice(0, 1).toUpperCase())
      .join('')
      .slice(0, 2);
      
    const newUser: User = {
      uid: firebaseUser.uid,
      name,
      email: firebaseUser.email || '',
      buddies: [],
      avatarUrl: firebaseUser.photoURL || undefined,
      initials
    };
    
    await setDoc(userDocRef, newUser);
    return newUser;
  } catch (err) {
    console.error('Google Sign-in error:', err);
    throw err;
  }
}

export async function getUserDoc(uid: string): Promise<User | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as User;
    }
    return null;
  } catch (err) {
    console.error('getUserDoc error:', err);
    return null;
  }
}

export const DEFAULT_USERS: User[] = [
  {
    uid: 'user_caner',
    name: 'Caner Özkan',
    email: 'caner@firma.com',
    buddies: ['user_ayse', 'user_burak'],
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    initials: 'CÖ'
  },
  {
    uid: 'user_ayse',
    name: 'Ayşe Demir',
    email: 'ayse@firma.com',
    buddies: ['user_caner', 'user_deniz'],
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
    initials: 'AD'
  },
  {
    uid: 'user_burak',
    name: 'Burak Yılmaz',
    email: 'burak@firma.com',
    buddies: ['user_caner', 'user_deniz'],
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
    initials: 'BY'
  },
  {
    uid: 'user_deniz',
    name: 'Deniz Şahin',
    email: 'deniz@firma.com',
    buddies: ['user_ayse', 'user_burak'],
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80',
    initials: 'DŞ'
  }
];

export async function seedMockUsers() {
  const path = 'users';
  try {
    for (const u of DEFAULT_USERS) {
      const userRef = doc(db, 'users', u.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, u);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeToUsers(onUpdate: (users: User[]) => void) {
  const path = 'users';
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users: User[] = [];
    snapshot.forEach((doc) => {
      users.push(doc.data() as User);
    });
    onUpdate(users);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export async function updateUser(uid: string, data: Partial<User>) {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, data);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteUserAccount(uid: string) {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);

    if (auth.currentUser && auth.currentUser.uid === uid) {
      try {
        await auth.currentUser.delete();
      } catch (authErr) {
        console.warn("Auth user deletion warning (might need reauth):", authErr);
        await firebaseSignOut(auth);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createCustomUser(userId: string, name: string, email: string) {
  const path = 'users';
  try {
    const customUid = `custom_${Date.now()}`;
    const initials = name
      .split(' ')
      .map(part => part.slice(0, 1).toUpperCase())
      .join('')
      .slice(0, 2);

    const newBuddy: User = {
      uid: customUid,
      name,
      email,
      buddies: [userId],
      initials
    };

    await setDoc(doc(db, 'users', customUid), newBuddy);
    await addBuddy(userId, customUid);

    // Create an accepted buddy request so it's instantly approved
    await setDoc(doc(db, 'buddy_requests', `${userId}_${customUid}`), {
      id: `${userId}_${customUid}`,
      fromId: userId,
      toId: customUid,
      status: 'accepted',
      createdAt: Date.now()
    });

    return newBuddy;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function addBuddy(userId: string, buddyId: string) {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const buddies = userSnap.data().buddies || [];
      if (!buddies.includes(buddyId)) {
        await updateDoc(userRef, {
          buddies: [...buddies, buddyId]
        });
      }
    }

    // Also reverse-add for the buddy so they are mutual friends in the co-worker pool
    const buddyRef = doc(db, 'users', buddyId);
    const buddySnap = await getDoc(buddyRef);
    if (buddySnap.exists()) {
      const buddyBuddies = buddySnap.data().buddies || [];
      if (!buddyBuddies.includes(userId)) {
        await updateDoc(buddyRef, {
          buddies: [...buddyBuddies, userId]
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function removeBuddy(userId: string, buddyId: string) {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const buddies = userSnap.data().buddies || [];
      await updateDoc(userRef, {
        buddies: buddies.filter((id: string) => id !== buddyId)
      });
    }

    const buddyRef = doc(db, 'users', buddyId);
    const buddySnap = await getDoc(buddyRef);
    if (buddySnap.exists()) {
      const buddyBuddies = buddySnap.data().buddies || [];
      await updateDoc(buddyRef, {
        buddies: buddyBuddies.filter((id: string) => id !== userId)
      });
    }

    // Also delete any buddy requests
    try {
      await deleteDoc(doc(db, 'buddy_requests', `${userId}_${buddyId}`));
      await deleteDoc(doc(db, 'buddy_requests', `${buddyId}_${userId}`));
    } catch (e) {
      console.warn("Could not delete buddy request document:", e);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ---------------- BUDDY REQUEST OPERATIONS ----------------

export function subscribeToBuddyRequests(userId: string, onUpdate: (requests: BuddyRequest[]) => void) {
  const path = 'buddy_requests';
  const q = query(
    collection(db, 'buddy_requests'),
    or(
      where('fromId', '==', userId),
      where('toId', '==', userId)
    )
  );
  return onSnapshot(q, (snapshot) => {
    const reqs: BuddyRequest[] = [];
    snapshot.forEach((doc) => {
      reqs.push(doc.data() as BuddyRequest);
    });
    // Sort by createdAt descending
    reqs.sort((a, b) => b.createdAt - a.createdAt);
    onUpdate(reqs);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export async function sendBuddyRequest(fromId: string, toId: string, fromName: string) {
  const path = 'buddy_requests';
  try {
    const reqId = `${fromId}_${toId}`;
    await setDoc(doc(db, 'buddy_requests', reqId), {
      id: reqId,
      fromId,
      toId,
      status: 'pending',
      createdAt: Date.now()
    });

    // Send real-time notification
    await createNotification({
      recipientId: toId,
      senderName: fromName,
      type: 'request',
      message: `${fromName} size yol arkadaşlığı onay talebi gönderdi.`,
      createdAt: Date.now(),
      read: false
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function acceptBuddyRequest(requestId: string, fromId: string, toId: string, toName: string) {
  const path = `buddy_requests/${requestId}`;
  try {
    // 1. Update request status to accepted
    await updateDoc(doc(db, 'buddy_requests', requestId), { status: 'accepted' });

    // 2. Add to sender's buddies
    const fromRef = doc(db, 'users', fromId);
    const fromSnap = await getDoc(fromRef);
    if (fromSnap.exists()) {
      const buddies = fromSnap.data().buddies || [];
      if (!buddies.includes(toId)) {
        await updateDoc(fromRef, { buddies: [...buddies, toId] });
      }
    }

    // 3. Add to receiver's buddies
    const toRef = doc(db, 'users', toId);
    const toSnap = await getDoc(toRef);
    if (toSnap.exists()) {
      const buddies = toSnap.data().buddies || [];
      if (!buddies.includes(fromId)) {
        await updateDoc(toRef, { buddies: [...buddies, fromId] });
      }
    }

    // 4. Notify sender
    await createNotification({
      recipientId: fromId,
      senderName: toName,
      type: 'approval',
      message: `${toName} yol arkadaşlığı onay talebinizi kabul etti!`,
      createdAt: Date.now(),
      read: false
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteBuddyRequest(requestId: string) {
  const path = `buddy_requests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'buddy_requests', requestId));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}


// ---------------- TRIP OPERATIONS ----------------

export async function createTrip(trip: Omit<Trip, 'id'>) {
  const path = 'trips';
  try {
    const tripId = doc(collection(db, 'trips')).id;
    const newTrip: Trip = {
      ...trip,
      id: tripId
    };
    await setDoc(doc(db, 'trips', tripId), newTrip);

    // Create a real-time notification to buddies
    const buddies = await getBuddies(trip.driverId);
    for (const buddyId of buddies) {
      await createNotification({
        recipientId: buddyId,
        senderName: trip.driverName,
        type: 'trip_created',
        message: `${trip.driverName} yeni bir yolculuk oluşturdu: ${trip.title} (${trip.date} - ${trip.time})`,
        createdAt: Date.now(),
        read: false
      });
    }

    return tripId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

async function getBuddies(userId: string): Promise<string[]> {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data().buddies || [];
  }
  return [];
}

export async function updateTrip(tripId: string, updates: Partial<Trip>) {
  const path = `trips/${tripId}`;
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeToTrips(onUpdate: (trips: Trip[]) => void) {
  const path = 'trips';
  return onSnapshot(collection(db, 'trips'), (snapshot) => {
    const trips: Trip[] = [];
    snapshot.forEach((doc) => {
      trips.push(doc.data() as Trip);
    });
    // Sort by date and time
    trips.sort((a, b) => {
      const dateTimeA = `${a.date}T${a.time}`;
      const dateTimeB = `${b.date}T${b.time}`;
      return dateTimeA.localeCompare(dateTimeB);
    });
    onUpdate(trips);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export async function sendJoinRequest(tripId: string, user: { uid: string, name: string, email: string }) {
  const path = `trips/${tripId}`;
  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);
    if (tripSnap.exists()) {
      const tripData = tripSnap.data() as Trip;
      const requests = tripData.requests || [];
      
      // Avoid duplicate requests
      if (requests.some(r => r.userId === user.uid)) return;

      const newRequest: JoinRequest = {
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        status: 'pending',
        timestamp: Date.now()
      };

      await updateDoc(tripRef, {
        requests: [...requests, newRequest]
      });

      // Send real-time notification to the driver
      await createNotification({
        recipientId: tripData.driverId,
        senderName: user.name,
        type: 'request',
        message: `${user.name}, "${tripData.title}" yolculuğunuza katılmak istiyor.`,
        createdAt: Date.now(),
        read: false
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function manageJoinRequest(tripId: string, passengerId: string, approve: boolean) {
  const path = `trips/${tripId}`;
  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);
    if (tripSnap.exists()) {
      const tripData = tripSnap.data() as Trip;
      const requests = tripData.requests || [];
      const passengers = tripData.passengers || [];

      const updatedRequests = requests.map(r => {
        if (r.userId === passengerId) {
          return { ...r, status: approve ? 'approved' as const : 'rejected' as const };
        }
        return r;
      });

      let updatedPassengers = [...passengers];
      if (approve && !passengers.includes(passengerId)) {
        updatedPassengers.push(passengerId);
      } else if (!approve) {
        updatedPassengers = updatedPassengers.filter(id => id !== passengerId);
      }

      await updateDoc(tripRef, {
        requests: updatedRequests,
        passengers: updatedPassengers
      });

      // Notify passenger
      await createNotification({
        recipientId: passengerId,
        senderName: tripData.driverName,
        type: approve ? 'approval' : 'rejection',
        message: `"${tripData.title}" yolculuğu talebiniz sürücü ${tripData.driverName} tarafından ${approve ? 'onaylandı' : 'reddedildi'}.`,
        createdAt: Date.now(),
        read: false
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function cancelJoinRequest(tripId: string, userId: string) {
  const path = `trips/${tripId}`;
  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);
    if (tripSnap.exists()) {
      const tripData = tripSnap.data() as Trip;
      const requests = tripData.requests || [];
      const passengers = tripData.passengers || [];

      const updatedRequests = requests.filter(r => r.userId !== userId);
      const updatedPassengers = passengers.filter(id => id !== userId);

      await updateDoc(tripRef, {
        requests: updatedRequests,
        passengers: updatedPassengers
      });

      // Fetch user details for notification
      const userSnap = await getDoc(doc(db, 'users', userId));
      const userName = userSnap.exists() ? userSnap.data().name : 'Yol Arkadaşı';

      // Notify driver about cancellation
      await createNotification({
        recipientId: tripData.driverId,
        senderName: userName,
        type: 'rejection',
        message: `${userName}, "${tripData.title}" yolculuğuna katılım talebini iptal etti.`,
        createdAt: Date.now(),
        read: false
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Complete trip and generate finances automatically
export async function completeTrip(tripId: string) {
  const path = `trips/${tripId}`;
  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);
    if (tripSnap.exists()) {
      const tripData = tripSnap.data() as Trip;
      
      // Update status
      await updateDoc(tripRef, { status: 'completed' });

      // Generate split cost finances
      const passengersCount = tripData.passengers?.length || 0;
      if (passengersCount > 0 && tripData.estimatedCost > 0) {
        const totalPeople = passengersCount + 1; // driver + passengers
        const splitCost = parseFloat((tripData.estimatedCost / totalPeople).toFixed(2));

        for (const passengerId of tripData.passengers) {
          // Fetch passenger name
          const passSnap = await getDoc(doc(db, 'users', passengerId));
          const passengerName = passSnap.exists() ? passSnap.data().name : 'Yolcu';

          const transactionId = doc(collection(db, 'finances')).id;
          const transaction: FinanceTransaction = {
            id: transactionId,
            tripId: tripData.id,
            tripTitle: tripData.title,
            date: tripData.date,
            payerId: passengerId,
            payerName: passengerName,
            receiverId: tripData.driverId,
            receiverName: tripData.driverName,
            amount: splitCost,
            status: 'pending',
            updatedAt: Date.now()
          };

          await setDoc(doc(db, 'finances', transactionId), transaction);

          // Notify passenger about the debt
          await createNotification({
            recipientId: passengerId,
            senderName: tripData.driverName,
            type: 'payment_received',
            message: `"${tripData.title}" yolculuğu tamamlandı. ${tripData.driverName}'e ${splitCost} zł borcunuz bulunuyor.`,
            createdAt: Date.now(),
            read: false
          });
        }
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateLiveLocation(tripId: string, userId: string, location: Omit<LiveLocation, 'userId' | 'updatedAt'>) {
  const path = `trips/${tripId}`;
  try {
    const tripRef = doc(db, 'trips', tripId);
    const fullLoc: LiveLocation = {
      ...location,
      userId,
      updatedAt: Date.now()
    };
    await updateDoc(tripRef, {
      [`liveLocations.${userId}`]: fullLoc
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ---------------- FINANCE OPERATIONS ----------------

export function subscribeToFinances(userId: string | undefined, onUpdate: (transactions: FinanceTransaction[]) => void) {
  const path = 'finances';
  if (!userId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'finances'),
    or(
      where('payerId', '==', userId),
      where('receiverId', '==', userId)
    )
  );
  return onSnapshot(q, (snapshot) => {
    const transactions: FinanceTransaction[] = [];
    snapshot.forEach((doc) => {
      transactions.push(doc.data() as FinanceTransaction);
    });
    // Sort by date desc
    transactions.sort((a, b) => b.updatedAt - a.updatedAt);
    onUpdate(transactions);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

// Mark debt as paid - synchronous real-time action!
export async function markAsPaid(transactionId: string) {
  const path = `finances/${transactionId}`;
  try {
    const transRef = doc(db, 'finances', transactionId);
    const transSnap = await getDoc(transRef);
    if (transSnap.exists()) {
      const trans = transSnap.data() as FinanceTransaction;
      
      await updateDoc(transRef, {
        status: 'paid',
        updatedAt: Date.now()
      });

      // Send real-time notification to the receiver (driver)
      await createNotification({
        recipientId: trans.receiverId,
        senderName: trans.payerName,
        type: 'payment_paid',
        message: `${trans.payerName}, "${trans.tripTitle}" yolculuğu için olan ${trans.amount} zł borcunu "Ödendi" olarak işaretledi.`,
        createdAt: Date.now(),
        read: false
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ---------------- NOTIFICATION OPERATIONS ----------------

export async function createNotification(notif: Omit<RealtimeNotification, 'id'>) {
  const path = 'notifications';
  try {
    const id = doc(collection(db, 'notifications')).id;
    await setDoc(doc(db, 'notifications', id), {
      ...notif,
      id
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeToNotifications(userId: string, onUpdate: (notifs: RealtimeNotification[]) => void) {
  const path = 'notifications';
  const q = query(collection(db, 'notifications'), where('recipientId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const notifs: RealtimeNotification[] = [];
    snapshot.forEach((doc) => {
      notifs.push(doc.data() as RealtimeNotification);
    });
    // Sort by date desc
    notifs.sort((a, b) => b.createdAt - a.createdAt);
    onUpdate(notifs);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export async function markNotificationAsRead(notifId: string) {
  const path = `notifications/${notifId}`;
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
