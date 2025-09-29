import React, { useEffect } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';

const requestAndroidPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_NETWORK_STATE,
      PermissionsAndroid.PERMISSIONS.INTERNET,
    ];

    const results = await PermissionsAndroid.requestMultiple(permissions);
    
    const allGranted = Object.values(results).every(
      result => result === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!allGranted) {
      Alert.alert(
        'Permissions Required',
        'Network permissions are required for speed testing functionality.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Error requesting permissions:', error);
    return false;
  }
};

const App: React.FC = () => {
  useEffect(() => {
    const initializeApp = async () => {
      await requestAndroidPermissions();
    };
    initializeApp();
  }, []);

  return <HomeScreen />;
};

export default App;