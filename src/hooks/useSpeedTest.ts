/**
 * useSpeedTest Hook - Gestión de estado centralizada
 * Principio SOLID: Single Responsibility - Solo maneja estado de SpeedTest
 * Patrón: Custom Hook para encapsular lógica de estado reutilizable
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SpeedTestResult,
  SpeedTestProgress,
  SpeedTestErrorInfo,
  SpeedTestContextValue,
  NetworkInfo,
  SPEED_TEST_CONSTANTS
} from '../types/SpeedTest';
import { createSpeedTestService, ISpeedTestService } from '../services/SpeedTestService';

// ===============================
// HOOK PRINCIPAL
// ===============================

export const useSpeedTest = (): SpeedTestContextValue => {
  // Estado local
  const [currentTest, setCurrentTest] = useState<SpeedTestResult | null>(null);
  const [progress, setProgress] = useState<SpeedTestProgress>({
    state: 'idle',
    progress: 0,
  });
  const [error, setError] = useState<SpeedTestErrorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testHistory, setTestHistory] = useState<SpeedTestResult[]>([]);
  
  // Referencias
  const serviceRef = useRef<ISpeedTestService | null>(null);

  // ===============================
  // INICIALIZACIÓN
  // ===============================

  useEffect(() => {
    // Crear servicio con callback de progreso
    serviceRef.current = createSpeedTestService((progress: SpeedTestProgress) => {
      setProgress(progress);
    });

    // Cargar historial al inicializar
    loadTestHistory();

    return () => {
      // Cleanup: detener test si está corriendo
      if (serviceRef.current?.isTestRunning()) {
        serviceRef.current.stopTest();
      }
    };
  }, []);

  // ===============================
  // FUNCIONES DE CARGA DE DATOS
  // ===============================

  const loadTestHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const key = 'speedtest_history';
      const storedData = await AsyncStorage.getItem(key);
      
      if (storedData) {
        const history: SpeedTestResult[] = JSON.parse(storedData);
        // Convertir timestamps de string a Date si es necesario
        const parsedHistory = history.map(result => ({
          ...result,
          timestamp: new Date(result.timestamp),
        }));
        setTestHistory(parsedHistory);
      }
    } catch (err) {
      console.warn('Error loading test history:', err);
      setError({
        type: 'unknown-error',
        message: 'Failed to load test history',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ===============================
  // FUNCIONES PRINCIPALES
  // ===============================

  const startTest = useCallback(async (): Promise<void> => {
    if (!serviceRef.current) {
      throw new Error('Service not initialized');
    }

    if (serviceRef.current.isTestRunning()) {
      return; // Ya hay un test corriendo
    }

    try {
      setError(null);
      setIsLoading(true);
      setCurrentTest(null);
      
      // Verificar conectividad antes de empezar
      const networkInfo = await serviceRef.current.getNetworkInfo();
      if (!networkInfo.isConnected) {
        throw {
          type: 'network-unavailable',
          message: 'No network connection available',
        };
      }

      // Iniciar test
      const result = await serviceRef.current.startTest();
      
      // Actualizar estado con resultado
      setCurrentTest(result);
      
      // Recargar historial para incluir el nuevo test
      await loadTestHistory();
      
    } catch (err) {
      const errorInfo = err as SpeedTestErrorInfo;
      setError(errorInfo);
      setProgress({ state: 'error', progress: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [loadTestHistory]);

  const stopTest = useCallback((): void => {
    if (serviceRef.current?.isTestRunning()) {
      serviceRef.current.stopTest();
      setProgress({ state: 'idle', progress: 0 });
      setIsLoading(false);
    }
  }, []);

  const retryTest = useCallback(async (): Promise<void> => {
    setError(null);
    await startTest();
  }, [startTest]);

  const clearHistory = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('speedtest_history');
      setTestHistory([]);
    } catch (err) {
      setError({
        type: 'unknown-error',
        message: 'Failed to clear history',
      });
    }
  }, []);

  // ===============================
  // VALOR DE RETORNO
  // ===============================

  return {
    // Estado actual
    currentTest,
    progress,
    error,
    isLoading: isLoading || progress.state === 'connecting',
    
    // Historial
    testHistory,
    
    // Acciones
    startTest,
    stopTest,
    clearHistory,
    retryTest,
  };
};

// ===============================
// HOOKS ADICIONALES UTILITARIOS
// ===============================

/**
 * Hook para obtener información de red
 */
export const useNetworkInfo = () => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNetworkInfo = async () => {
      try {
        const service = createSpeedTestService();
        const info = await service.getNetworkInfo();
        setNetworkInfo(info);
      } catch (error) {
        console.warn('Error loading network info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNetworkInfo();
  }, []);

  return { networkInfo, isLoading };
};

/**
 * Hook para estadísticas del historial
 */
export const useSpeedTestStats = (history: SpeedTestResult[]) => {
  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        averageDownload: 0,
        averageUpload: 0,
        averagePing: 0,
        totalTests: 0,
        lastTestDate: null,
      };
    }

    const totalDownload = history.reduce((sum, test) => sum + test.downloadSpeed, 0);
    const totalUpload = history.reduce((sum, test) => sum + test.uploadSpeed, 0);
    const totalPing = history.reduce((sum, test) => sum + test.ping, 0);

    return {
      averageDownload: Math.round((totalDownload / history.length) * 100) / 100,
      averageUpload: Math.round((totalUpload / history.length) * 100) / 100,
      averagePing: Math.round(totalPing / history.length),
      totalTests: history.length,
      lastTestDate: history[0]?.timestamp || null,
    };
  }, [history]);

  return stats;
};

/**
 * Hook para auto-retry en caso de errores de red
 */
export const useAutoRetry = (
  error: SpeedTestErrorInfo | null,
  retryFunction: () => Promise<void>,
  maxRetries: number = 3
) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (
      error &&
      error.type === 'network-unavailable' &&
      retryCount < maxRetries &&
      !isRetrying
    ) {
      const timer = setTimeout(async () => {
        setIsRetrying(true);
        try {
          await retryFunction();
          setRetryCount(0); // Reset counter on success
        } catch (err) {
          setRetryCount(prev => prev + 1);
        } finally {
          setIsRetrying(false);
        }
      }, 2000 * (retryCount + 1)); // Exponential backoff

      return () => clearTimeout(timer);
    }
  }, [error, retryCount, retryFunction, maxRetries, isRetrying]);

  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    retryCount,
    isRetrying,
    hasReachedMaxRetries: retryCount >= maxRetries,
    resetRetry,
  };
};