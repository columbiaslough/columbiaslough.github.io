import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB_96ExmyXRlV2RMRv2_-7agrmR3lBaywA",
    authDomain: "columbia-52ee8.firebaseapp.com",
    projectId: "columbia-52ee8",
    storageBucket: "columbia-52ee8.firebasestorage.app",
    messagingSenderId: "614466267751",
    appId: "1:614466267751:web:9ef5552ec1186ea57e02c2",
    measurementId: "G-H0N5XRMZJS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { auth, db };

export const loginUser = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const logoutUser = async () => {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export async function fetchFeatures(collectionName) {
    const features = [];
    const querySnapshot = await getDocs(collection(db, collectionName));
   
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        const images = Array.isArray(data.images) ? data.images : [];
        const tags = Array.isArray(data.tags) ? data.tags : [];
        
        let geometry;
        
        if (data.geometry && typeof data.geometry === 'object' && !Array.isArray(data.geometry)) {
            geometry = {
                type: data.geometry.type || "Point",
                coordinates: Array.isArray(data.geometry.coordinates) 
                    ? data.geometry.coordinates 
                    : [data.geometry.coordinates?.[0] || 0, data.geometry.coordinates?.[1] || 0]
            };
        } else if (data.geometryJson) {
            try {
                geometry = JSON.parse(data.geometryJson);
            } catch (error) {
                console.error(`Error parsing geometryJson for doc ${doc.id}:`, error);
                geometry = {
                    type: "Point",
                    coordinates: [data.longitude || 0, data.latitude || 0]
                };
            }
        } else if (data.longitude && data.latitude) {
            geometry = {
                type: "Point",
                coordinates: [data.longitude, data.latitude]
            };
        } else {
            console.warn(`No geometry data found for doc ${doc.id} in collection ${collectionName}`);
            return; 
        }
       
        const feature = {
            type: "Feature",
            id: doc.id,
            properties: {
                ...data,
                id: doc.id,
                labelId: doc.id.split('_')[1] || doc.objectId,
                images: images.join(','),
                tags: tags.join(',')
            },
            geometry: geometry
        };
       
        delete feature.properties.geometry;
        delete feature.properties.geometryJson;
        delete feature.properties.longitude;
        delete feature.properties.latitude;
        delete feature.properties.geopoint;
       
        features.push(feature);
    });
    
    return {
        type: "FeatureCollection",
        features: features
    };
}

export async function updateFeature(collection, id, updatedData) {
    try {
        if (!collection || !id) {
            throw new Error(`Invalid collection or id: ${collection}/${id}`);
        }

        const ref = doc(db, collection, String(id));
        await updateDoc(ref, updatedData);
        console.log(`Updated ${collection}/${id}`);
        return { success: true };
    } catch (error) {
        console.error('Error updating feature:', error);
        return { success: false, error: error.message };
    }
}

export async function addFeature(collectionName, featureData) {
    try {
        if (!collectionName) {
            throw new Error(`Invalid collection: ${collectionName}`);
        }

        const collectionRef = collection(db, collectionName);
        const docRef = await addDoc(collectionRef, featureData);
        
        console.log(`Added new feature to ${collectionName} with ID: ${docRef.id}`);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding feature:', error);
        return { success: false, error: error.message };
    }
}