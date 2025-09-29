/**
 * HomeScreen - Pantalla principal de la aplicación SpeedTest
 * Integra todos los componentes y hooks de la arquitectura
 * Principio SOLID: Composición sobre herencia
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import SpeedMeter from '../components/speedtest/SpeedMeter';
import { useSpeedTest, useNetworkInfo, useSpeedTestStats } from '../hooks/useSpeedTest';
import { SpeedTestState } from '../types/SpeedTest';

// ===============================
// CONFIGURACIÓN DE COLORES Y ESTILOS
// ===============================

const COLORS = {
  primary: '#2196F3',
  primaryDark: '#1976D2',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
};

// ===============================
// COMPONENTE PRINCIPAL
// ===============================

export const HomeScreen: React.FC = () => {
  // Hooks
  const {
    currentTest,
    progress,
    error,
    isLoading,
    testHistory,
    startTest,
    stopTest,
    retryTest,
    clearHistory,
  } = useSpeedTest();

  const { networkInfo } = useNetworkInfo();
  const stats = useSpeedTestStats(testHistory);

  // Estado local
  const [refreshing, setRefreshing] = useState(false);

  // ===============================
  // FUNCIONES DE EVENTOS
  // ===============================

  const handleStartTest = useCallback(async () => {
    try {
      await startTest();
    } catch (err) {
      Alert.alert(
        'Test Failed',
        'Unable to start speed test. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  }, [startTest]);

  const handleStopTest = useCallback(() => {
    Alert.alert(
      'Stop Test',
      'Are you sure you want to stop the current test?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: stopTest },
      ]
    );
  }, [stopTest]);

  const handleRetryTest = useCallback(async () => {
    try {
      await retryTest();
    } catch (err) {
      Alert.alert(
        'Retry Failed',
        'Unable to retry the test. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }, [retryTest]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all test history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearHistory },
      ]
    );
  }, [clearHistory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simular tiempo de refresh
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // ===============================
  // FUNCIONES UTILITARIAS
  // ===============================

  const getStateMessage = (state: SpeedTestState): string => {
    switch (state) {
      case 'connecting':
        return 'Connecting to server...';
      case 'testing-ping':
        return 'Testing ping...';
      case 'testing-download':
        return 'Testing download speed...';
      case 'testing-upload':
        return 'Testing upload speed...';
      case 'completed':
        return 'Test completed!';
      case 'error':
        return 'Test failed';
      default:
        return 'Ready to start';
    }
  };

  const getNetworkStatusColor = (): string => {
    if (!networkInfo) return COLORS.textSecondary;
    if (!networkInfo.isConnected) return COLORS.error;
    if (!networkInfo.isInternetReachable) return COLORS.warning;
    return COLORS.success;
  };

  const getButtonTitle = (): string => {
    if (isLoading || ['connecting', 'testing-ping', 'testing-download', 'testing-upload'].includes(progress.state)) {
      return 'Stop Test';
    }
    if (error) {
      return 'Retry Test';
    }
    return 'Start Test';
  };

  const getButtonAction = () => {
    if (isLoading || ['connecting', 'testing-ping', 'testing-download', 'testing-upload'].includes(progress.state)) {
      return handleStopTest;
    }
    if (error) {
      return handleRetryTest;
    }
    return handleStartTest;
  };

  // ===============================
  // RENDER DE COMPONENTES
  // ===============================

  const renderNetworkStatus = () => (
    <View style={styles.networkStatus}>
      <View style={styles.networkIndicator}>
        <View 
          style={[
            styles.networkDot, 
            { backgroundColor: getNetworkStatusColor() }
          ]} 
        />
        <Text style={styles.networkText}>
          {networkInfo ? (
            `${networkInfo.type.toUpperCase()} ${networkInfo.isConnected ? 'Connected' : 'Disconnected'}`
          ) : (
            'Checking network...'
          )}
        </Text>
      </View>
    </View>
  );

  const renderSpeedMeter = () => {
    const isTestActive = ['testing-download', 'testing-upload'].includes(progress.state);
    const currentSpeed = progress.state === 'testing-download' 
      ? progress.currentSpeed || 0
      : progress.state === 'testing-upload'
      ? progress.currentSpeed || 0
      : currentTest?.downloadSpeed || 0;

    return (
      <View style={styles.meterContainer}>
        <SpeedMeter
          currentSpeed={currentSpeed}
          maxSpeed={100} // Dynamic max based on test history
          testType={progress.state === 'testing-upload' ? 'upload' : 'download'}
          isActive={isTestActive}
          size="large"
        />
      </View>
    );
  };

  const renderTestResults = () => {
    if (!currentTest && progress.state !== 'completed') return null;

    const result = currentTest;
    if (!result) return null;

    return (
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Last Test Results</Text>
        
        <View style={styles.resultsGrid}>
          <View style={styles.resultItem}>
            <Text style={styles.resultValue}>{result.downloadSpeed.toFixed(1)}</Text>
            <Text style={styles.resultLabel}>Download (Mbps)</Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={styles.resultValue}>{result.uploadSpeed.toFixed(1)}</Text>
            <Text style={styles.resultLabel}>Upload (Mbps)</Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={styles.resultValue}>{result.ping}</Text>
            <Text style={styles.resultLabel}>Ping (ms)</Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={styles.resultValue}>{result.jitter}</Text>
            <Text style={styles.resultLabel}>Jitter (ms)</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <Text style={styles.statsTitle}>Statistics</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalTests}</Text>
          <Text style={styles.statLabel}>Total Tests</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.averageDownload.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Avg Download</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.averageUpload.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Avg Upload</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.averagePing}</Text>
          <Text style={styles.statLabel}>Avg Ping</Text>
        </View>
      </View>
    </View>
  );

  const renderControls = () => (
    <View style={styles.controlsContainer}>
      {/* Botón principal */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          isLoading && styles.primaryButtonLoading,
          error && styles.primaryButtonError,
        ]}
        onPress={getButtonAction()}
        disabled={!networkInfo?.isConnected}
      >
        <Text style={styles.primaryButtonText}>
          {getButtonTitle()}
        </Text>
      </TouchableOpacity>

      {/* Progress bar */}
      {isLoading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progress.progress}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {getStateMessage(progress.state)} ({Math.round(progress.progress)}%)
          </Text>
        </View>
      )}

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      )}

      {/* Secondary buttons */}
      <View style={styles.secondaryButtons}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleClearHistory}
          disabled={testHistory.length === 0}
        >
          <Text style={[
            styles.secondaryButtonText,
            testHistory.length === 0 && styles.secondaryButtonTextDisabled
          ]}>
            Clear History
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===============================
  // RENDER PRINCIPAL
  // ===============================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Speed Test</Text>
          <Text style={styles.headerSubtitle}>Test your internet connection</Text>
        </View>

        {/* Network Status */}
        {renderNetworkStatus()}

        {/* Speed Meter */}
        {renderSpeedMeter()}

        {/* Test Results */}
        {renderTestResults()}

        {/* Statistics */}
        {renderStats()}

        {/* Controls */}
        {renderControls()}
      </ScrollView>
    </SafeAreaView>
  );
};

// ===============================
// ESTILOS
// ===============================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingBottom: 32,
  },
  
  header: {
    padding: 24,
    alignItems: 'center',
  },
  
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  
  headerSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  
  networkStatus: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  
  networkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  networkDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  
  networkText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  
  meterContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  
  resultsContainer: {
    margin: 24,
    padding: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  
  resultItem: {
    width: '50%',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  resultValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  
  resultLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  
  statsContainer: {
    margin: 24,
    marginTop: 0,
    padding: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  
  statItem: {
    width: '25%',
    alignItems: 'center',
  },
  
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  
  controlsContainer: {
    margin: 24,
    marginTop: 0,
  },
  
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 16,
  },
  
  primaryButtonLoading: {
    backgroundColor: COLORS.warning,
  },
  
  primaryButtonError: {
    backgroundColor: COLORS.error,
  },
  
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  progressContainer: {
    marginBottom: 16,
  },
  
  progressBar: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  
  progressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  
  errorContainer: {
    padding: 12,
    backgroundColor: COLORS.error + '20',
    borderRadius: 8,
    marginBottom: 16,
  },
  
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
  
  secondaryButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  
  secondaryButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
});

export default HomeScreen;