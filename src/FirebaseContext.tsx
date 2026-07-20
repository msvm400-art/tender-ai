import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  User as FirebaseUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase.js";

interface FirebasePreset {
  id: string;
  userId: string;
  name: string;
  filters: any;
}

interface FirebaseContextType {
  firebaseUser: FirebaseUser | null;
  isEnabled: boolean;
  isReady: boolean;
  firestorePresets: FirebasePreset[];
  firestoreVaultFiles: any[];
  firestoreAlerts: any[];
  firestoreUser: any | null;
  firestoreProfile: any | null;
  signInWithGoogle: () => Promise<void>;
  logOutFirebase: () => Promise<void>;
  savePresetToFirestore: (id: string, name: string, filters: any) => Promise<void>;
  deletePresetFromFirestore: (id: string) => Promise<void>;
  saveProfileToFirestore: (profile: any) => Promise<void>;
  saveUserToFirestore: (userInfo: any) => Promise<void>;
  saveDocumentVaultToFirestore: (vault: any) => Promise<void>;
  deleteDocumentVaultFromFirestore: (id: string) => Promise<void>;
  saveAlertToFirestore: (alertItem: any) => Promise<void>;
  markAlertReadInFirestore: (id: string) => Promise<void>;
  markAllAlertsReadInFirestore: () => Promise<void>;
  saveBidDocumentToFirestore: (bidDoc: any) => Promise<void>;
  deleteBidDocumentFromFirestore: (bidId: string) => Promise<void>;
  saveTenderMatchToFirestore: (match: any) => Promise<void>;
  saveTenderQAToFirestore: (qa: any) => Promise<void>;
  savePaymentIntentToFirestore: (paymentIntent: any) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [firestorePresets, setFirestorePresets] = useState<FirebasePreset[]>([]);
  const [firestoreVaultFiles, setFirestoreVaultFiles] = useState<any[]>([]);
  const [firestoreAlerts, setFirestoreAlerts] = useState<any[]>([]);
  const [firestoreUser, setFirestoreUser] = useState<any | null>(null);
  const [firestoreProfile, setFirestoreProfile] = useState<any | null>(null);

  // Sync current user metadata in real-time if logged in
  useEffect(() => {
    if (!firebaseUser) {
      setFirestoreUser(null);
      return;
    }

    const pathStr = `users/${firebaseUser.uid}`;
    const docRef = doc(db, "users", firebaseUser.uid);
    
    const unsubscribeSnapshot = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setFirestoreUser(docSnap.data());
        } else {
          setFirestoreUser(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, pathStr);
      }
    );

    return () => unsubscribeSnapshot();
  }, [firebaseUser]);

  // Sync current company profile in real-time
  useEffect(() => {
    if (!firebaseUser) {
      setFirestoreProfile(null);
      return;
    }

    const pathStr = "companyProfiles";
    const q = query(collection(db, pathStr), where("userId", "==", firebaseUser.uid));
    
    const unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          setFirestoreProfile(snapshot.docs[0].data());
        } else {
          setFirestoreProfile(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, pathStr);
      }
    );

    return () => unsubscribeSnapshot();
  }, [firebaseUser]);

  useEffect(() => {
    // onAuthStateChanged to track user auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync saved presets from firestore in real-time if logged in
  useEffect(() => {
    if (!firebaseUser) {
      setFirestorePresets([]);
      return;
    }

    const pathStr = "filterPresets";
    const q = query(collection(db, pathStr), where("userId", "==", firebaseUser.uid));
    
    const unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const list: FirebasePreset[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as FirebasePreset);
        });
        setFirestorePresets(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, pathStr);
      }
    );

    return () => unsubscribeSnapshot();
  }, [firebaseUser]);

  // Sync document vault entries from firestore in real-time if logged in
  useEffect(() => {
    if (!firebaseUser) {
      setFirestoreVaultFiles([]);
      return;
    }

    const pathStr = "documentVaults";
    const q = query(collection(db, pathStr), where("userId", "==", firebaseUser.uid));
    
    const unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        setFirestoreVaultFiles(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, pathStr);
      }
    );

    return () => unsubscribeSnapshot();
  }, [firebaseUser]);

  // Sync alerts from firestore in real-time if logged in
  useEffect(() => {
    if (!firebaseUser) {
      setFirestoreAlerts([]);
      return;
    }

    const pathStr = "alerts";
    const q = query(collection(db, pathStr), where("userId", "==", firebaseUser.uid));
    
    const unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        // Sort by sentAt newest first
        list.sort((a, b) => new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime());
        setFirestoreAlerts(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, pathStr);
      }
    );

    return () => unsubscribeSnapshot();
  }, [firebaseUser]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Auth SignIn Popup failed:", err);
    }
  };

  const logOutFirebase = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Firebase SignOut failed:", err);
    }
  };

  const savePresetToFirestore = async (id: string, name: string, filters: any) => {
    if (!firebaseUser) return;
    const pathStr = `filterPresets/${id}`;
    try {
      await setDoc(doc(db, "filterPresets", id), {
        id,
        userId: firebaseUser.uid,
        name,
        filters
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const deletePresetFromFirestore = async (id: string) => {
    if (!firebaseUser) return;
    const pathStr = `filterPresets/${id}`;
    try {
      await deleteDoc(doc(db, "filterPresets", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, pathStr);
    }
  };

  const saveProfileToFirestore = async (profile: any) => {
    if (!firebaseUser || !profile) return;
    const pathStr = `companyProfiles/${profile.id}`;
    try {
      // Create clean profile payload matching exactly the 17 schema keys expected by firestore.rules
      const cleanProfile = {
        id: profile.id,
        userId: firebaseUser.uid,
        companyName: profile.companyName || "",
        registrationNumber: profile.registrationNumber || "",
        gstNumber: (profile.gstNumber || "").toUpperCase(),
        panNumber: (profile.panNumber || "").toUpperCase(),
        annualTurnover: Number(profile.annualTurnover || 0),
        yearsOfExperience: Number(profile.yearsOfExperience || 0),
        categories: profile.categories || [],
        certifications: profile.certifications || [],
        states: profile.states || profile.operationalStates || [],
        msmeRegistered: !!profile.msmeRegistered,
        employeeCount: Number(profile.employeeCount || 0),
        pastProjects: profile.pastProjects || [],
        isActive: profile.isActive ?? true,
        createdAt: profile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "companyProfiles", profile.id), cleanProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const saveUserToFirestore = async (userInfo: any) => {
    if (!firebaseUser || !userInfo) return;
    const pathStr = `users/${firebaseUser.uid}`;
    try {
      const cleanPhone = (userInfo.phone || "").slice(0, 32) || "919999999999";
      await setDoc(doc(db, "users", firebaseUser.uid), {
        id: firebaseUser.uid,
        email: (firebaseUser.email || userInfo.email || "test@example.com").slice(0, 256),
        name: (firebaseUser.displayName || userInfo.name || "SME User").slice(0, 256),
        phone: cleanPhone,
        plan: userInfo.plan || "FREE"
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const saveDocumentVaultToFirestore = async (vault: any) => {
    if (!firebaseUser || !vault) return;
    const pathStr = `documentVaults/${vault.id}`;
    try {
      await setDoc(doc(db, "documentVaults", vault.id), {
        id: vault.id,
        companyProfileId: vault.companyProfileId || "cp-1",
        userId: firebaseUser.uid,
        documentType: vault.documentType,
        fileName: vault.fileName,
        s3Url: vault.s3Url || "https://tenderai-docs.s3.ap-south-1.amazonaws.com/cp-1/custom.pdf",
        expiryDate: vault.expiryDate || null,
        isVerified: vault.isVerified ?? true,
        year: vault.year ? Number(vault.year) : null
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const deleteDocumentVaultFromFirestore = async (id: string) => {
    if (!firebaseUser) return;
    const pathStr = `documentVaults/${id}`;
    try {
      await deleteDoc(doc(db, "documentVaults", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, pathStr);
    }
  };

  const saveAlertToFirestore = async (alertItem: any) => {
    if (!firebaseUser || !alertItem) return;
    const pathStr = `alerts/${alertItem.id}`;
    try {
      await setDoc(doc(db, "alerts", alertItem.id), {
        id: alertItem.id,
        userId: firebaseUser.uid,
        tenderId: alertItem.tenderId || "",
        type: alertItem.type,
        channel: alertItem.channel || "IN_APP",
        message: alertItem.message,
        isRead: alertItem.isRead ?? false,
        sentAt: alertItem.sentAt || new Date().toISOString(),
        createdAt: alertItem.createdAt || new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const markAlertReadInFirestore = async (id: string) => {
    if (!firebaseUser) return;
    const pathStr = `alerts/${id}`;
    try {
      await setDoc(doc(db, "alerts", id), {
        isRead: true
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const markAllAlertsReadInFirestore = async () => {
    if (!firebaseUser) return;
    // Walk over all cached firestoreAlerts and trigger read flags
    try {
      for (const al of firestoreAlerts) {
        if (!al.isRead) {
          await setDoc(doc(db, "alerts", al.id), {
            isRead: true
          }, { merge: true });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "alerts/all-read");
    }
  };

  const saveBidDocumentToFirestore = async (bidDoc: any) => {
    if (!firebaseUser || !bidDoc) return;
    const pathStr = `bidDocuments/${bidDoc.id}`;
    try {
      // 10 exact keys required by isValidBidDocument
      const cleanBid = {
        id: bidDoc.id,
        tenderId: bidDoc.tenderId,
        companyProfileId: bidDoc.companyProfileId || "cp-1",
        userId: firebaseUser.uid,
        type: bidDoc.type,
        content: bidDoc.content || "",
        s3Url: bidDoc.s3Url || null,
        version: Number(bidDoc.version || 1),
        isAiGenerated: !!bidDoc.isAiGenerated,
        createdAt: bidDoc.createdAt || new Date().toISOString()
      };
      await setDoc(doc(db, "bidDocuments", bidDoc.id), cleanBid);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const deleteBidDocumentFromFirestore = async (bidId: string) => {
    if (!firebaseUser) return;
    const pathStr = `bidDocuments/${bidId}`;
    try {
      await deleteDoc(doc(db, "bidDocuments", bidId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, pathStr);
    }
  };

  const saveTenderMatchToFirestore = async (match: any) => {
    if (!firebaseUser || !match) return;
    const pathStr = `tenderMatches/${match.id}`;
    try {
      // 7 exact keys required by isValidTenderMatch
      const cleanMatch = {
        id: match.id,
        tenderId: match.tenderId,
        companyProfileId: match.companyProfileId || "cp-1",
        matchScore: Number(match.matchScore || 0),
        matchBreakdown: match.matchBreakdown || {},
        isBookmarked: !!match.isBookmarked,
        userStatus: match.userStatus || "NEW"
      };
      await setDoc(doc(db, "tenderMatches", match.id), cleanMatch);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const saveTenderQAToFirestore = async (qa: any) => {
    if (!firebaseUser || !qa) return;
    const pathStr = `tenderQAs/${qa.id}`;
    try {
      // exact keys and validations in rules
      const cleanQA = {
        id: qa.id,
        tenderId: qa.tenderId,
        userId: firebaseUser.uid,
        question: (qa.question || "").slice(0, 2048),
        answer: (qa.answer || "").slice(0, 1048576)
      };
      await setDoc(doc(db, "tenderQAs", qa.id), cleanQA);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  const savePaymentIntentToFirestore = async (paymentIntent: any) => {
    if (!firebaseUser || !paymentIntent) return;
    const pathStr = `paymentIntents/${paymentIntent.id}`;
    try {
      // 9 exact keys required by isValidPaymentIntent
      const cleanIntent = {
        id: paymentIntent.id,
        userId: firebaseUser.uid,
        planId: paymentIntent.planId || "FREE",
        amount: Number(paymentIntent.amount || 0),
        billingCycle: paymentIntent.billingCycle || "MONTHLY",
        gateway: paymentIntent.gateway || "RAZORPAY",
        method: paymentIntent.method || "CARD",
        status: "CAPTURED",
        createdAt: paymentIntent.createdAt || new Date().toISOString()
      };
      await setDoc(doc(db, "paymentIntents", paymentIntent.id), cleanIntent);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathStr);
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        isEnabled: true,
        isReady,
        firestorePresets,
        firestoreVaultFiles,
        firestoreAlerts,
        firestoreUser,
        firestoreProfile,
        signInWithGoogle,
        logOutFirebase,
        savePresetToFirestore,
        deletePresetFromFirestore,
        saveProfileToFirestore,
        saveUserToFirestore,
        saveDocumentVaultToFirestore,
        deleteDocumentVaultFromFirestore,
        saveAlertToFirestore,
        markAlertReadInFirestore,
        markAllAlertsReadInFirestore,
        saveBidDocumentToFirestore,
        deleteBidDocumentFromFirestore,
        saveTenderMatchToFirestore,
        saveTenderQAToFirestore,
        savePaymentIntentToFirestore
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};
