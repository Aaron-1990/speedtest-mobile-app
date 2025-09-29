/**
 * SpeedTestService - Lógica de negocio centralizada
 * Principios SOLID aplicados:
 * - Single Responsibility: Solo maneja testing de velocidad
 * - Open/Closed: Extensible para nuevos tipos de test
 * - Dependency Inversion: Inyección de dependencias para APIs de red
 */

import {
  SpeedTestResult,
  SpeedTestConfig,
  SpeedTestProgress,
  SpeedTestState,
  SpeedTestError,
  SpeedTestErrorInfo,
  NetworkInfo,
  ServerInfo,
  DeviceInfo,
  SPEED_TEST_CONSTANTS
} from '../types/SpeedTest';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===============================
// CONFIGURACIÓN POR DEFECTO
// ===============================

const DEFAULT_CONFIG: SpeedTestConfig = {
  testDuration: 10, // seconds
  downloadTestUrl: 'https://speed.cloudflare.com/__down',
  uploadTestUrl: 'https://speed.cloudflare.com/__up',
  pingTestUrl: 'https://1.1.1.1',
  maxConcurrentConnections: 4,
  retryAttempts: 3,
  timeout: SPEED_TEST_CONSTANTS.DEFAULT_TIMEOUT,
};

// ===============================
// INTERFAZ DEL SERVICIO
// ===============================

export interface ISpeedTestService {
  startTest(config?: Partial<SpeedTestConfig>): Promise<SpeedTestResult>;
  stopTest(): void;
  getNetworkInfo(): Promise<NetworkInfo>;
  getDeviceInfo(): DeviceInfo;
  isTestRunning(): boolean;
}

// ===============================
// IMPLEMENTACIÓN DEL SERVICIO
// ===============================

export class SpeedTestService implements ISpeedTestService {
  private isRunning = false;
  private shouldStop = false;
  private currentConfig: SpeedTestConfig = DEFAULT_CONFIG;
  private progressCallback?: (progress: SpeedTestProgress) => void;

  constructor(progressCallback?: (progress: SpeedTestProgress) => void) {
    this.progressCallback = progressCallback;
  }

  // ===============================
  // MÉTODOS PÚBLICOS
  // ===============================

  async startTest(config?: Partial<SpeedTestConfig>): Promise<SpeedTestResult> {
    if (this.isRunning) {
      throw this.createError('unknown-error', 'Test already running');
    }

    this.currentConfig = { ...DEFAULT_CONFIG, ...config };
    this.isRunning = true;
    this.shouldStop = false;

    try {
      // Validar conectividad
      const networkInfo = await this.getNetworkInfo();
      if (!networkInfo.isConnected) {
        throw this.createError('network-unavailable', 'No network connection');
      }

      // Obtener información del dispositivo
      const deviceInfo = this.getDeviceInfo();

      // Ejecutar secuencia de tests
      const result = await this.executeTestSequence(networkInfo, deviceInfo);
      
      // Guardar resultado
      await this.saveTestResult(result);
      
      return result;

    } catch (error) {
      this.updateProgress('error', 0);
      throw error;
    } finally {
      this.isRunning = false;
      this.shouldStop = false;
    }
  }

  stopTest(): void {
    this.shouldStop = true;
    this.isRunning = false;
    this.updateProgress('idle', 0);
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    const netInfo = await NetInfo.fetch();
    
    return {
      type: this.mapNetworkType(netInfo.type),
      isConnected: netInfo.isConnected || false,
      isInternetReachable: netInfo.isInternetReachable || false,
      carrier: netInfo.details?.carrier,
      ipAddress: netInfo.details?.ipAddress,
    };
  }

  getDeviceInfo(): DeviceInfo {
    return {
      platform: Platform.OS as 'android' | 'ios',
      model: Platform.constants?.Model || 'Unknown',
      osVersion: Platform.Version.toString(),
      appVersion: '1.0.0', // TODO: Get from package.json
    };
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

  // ===============================
  // MÉTODOS PRIVADOS - SECUENCIA DE TESTS
  // ===============================

  private async executeTestSequence(
    networkInfo: NetworkInfo,
    deviceInfo: DeviceInfo
  ): Promise<SpeedTestResult> {
    
    const testId = this.generateTestId();
    const serverInfo = await this.selectBestServer();

    // 1. Test de Ping
    this.updateProgress('testing-ping', 10);
    const pingResult = await this.testPing(serverInfo);
    this.checkShouldStop();

    // 2. Test de Download
    this.updateProgress('testing-download', 30);
    const downloadSpeed = await this.testDownload();
    this.checkShouldStop();

    // 3. Test de Upload  
    this.updateProgress('testing-upload', 70);
    const uploadSpeed = await this.testUpload();
    this.checkShouldStop();

    this.updateProgress('completed', 100);

    return {
      id: testId,
      timestamp: new Date(),
      downloadSpeed: downloadSpeed,
      uploadSpeed: uploadSpeed,
      ping: pingResult.ping,
      jitter: pingResult.jitter,
      packetLoss: pingResult.packetLoss,
      serverInfo,
      deviceInfo,
      networkInfo,
    };
  }

  // ===============================
  // IMPLEMENTACIÓN DE TESTS INDIVIDUALES
  // ===============================

  private async testPing(server: ServerInfo): Promise<{
    ping: number;
    jitter: number;
    packetLoss: number;
  }> {
    const pings: number[] = [];
    const samples = SPEED_TEST_CONSTANTS.PING_SAMPLES;

    for (let i = 0; i < samples; i++) {
      this.checkShouldStop();
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(this.currentConfig.pingTestUrl, {
          method: 'HEAD',
          cache: 'no-cache',
        });
        
        if (response.ok) {
          const ping = Date.now() - startTime;
          pings.push(ping);
        }
      } catch (error) {
        // Ping failed, skip this sample
      }

      // Small delay between pings
      await this.sleep(100);
    }

    if (pings.length === 0) {
      throw this.createError('server-unreachable', 'Could not reach ping server');
    }

    const avgPing = pings.reduce((a, b) => a + b) / pings.length;
    const jitter = this.calculateJitter(pings);
    const packetLoss = ((samples - pings.length) / samples) * 100;

    return {
      ping: Math.round(avgPing),
      jitter: Math.round(jitter),
      packetLoss: Math.round(packetLoss * 10) / 10,
    };
  }

  private async testDownload(): Promise<number> {
    const startTime = Date.now();
    const duration = this.currentConfig.testDuration * 1000;
    let totalBytes = 0;

    try {
      const response = await fetch(this.currentConfig.downloadTestUrl);
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('Could not create reader');
      }

      while (Date.now() - startTime < duration && !this.shouldStop) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        totalBytes += value?.length || 0;
        
        // Update progress
        const progress = 30 + ((Date.now() - startTime) / duration) * 40;
        this.updateProgress('testing-download', Math.min(progress, 70));
      }

      reader.releaseLock();
      
    } catch (error) {
      throw this.createError('server-unreachable', 'Download test failed');
    }

    // Calculate speed in Mbps
    const timeSeconds = (Date.now() - startTime) / 1000;
    const bitsPerSecond = (totalBytes * 8) / timeSeconds;
    const mbps = bitsPerSecond / (1024 * 1024);

    return Math.round(mbps * 100) / 100;
  }

  private async testUpload(): Promise<number> {
    const startTime = Date.now();
    const duration = this.currentConfig.testDuration * 1000;
    const chunkSize = 32 * 1024; // 32KB chunks
    let totalBytes = 0;

    // Generate test data
    const testData = new Uint8Array(chunkSize).fill(65); // Fill with 'A'

    try {
      while (Date.now() - startTime < duration && !this.shouldStop) {
        const response = await fetch(this.currentConfig.uploadTestUrl, {
          method: 'POST',
          body: testData,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        });

        if (response.ok) {
          totalBytes += chunkSize;
        }

        // Update progress
        const progress = 70 + ((Date.now() - startTime) / duration) * 25;
        this.updateProgress('testing-upload', Math.min(progress, 95));
      }

    } catch (error) {
      throw this.createError('server-unreachable', 'Upload test failed');
    }

    // Calculate speed in Mbps
    const timeSeconds = (Date.now() - startTime) / 1000;
    const bitsPerSecond = (totalBytes * 8) / timeSeconds;
    const mbps = bitsPerSecond / (1024 * 1024);

    return Math.round(mbps * 100) / 100;
  }

  // ===============================
  // MÉTODOS UTILITARIOS
  // ===============================

  private async selectBestServer(): Promise<ServerInfo> {
    // TODO: Implement server selection logic
    // For now, return a default server
    return {
      id: 'cloudflare-1',
      name: 'Cloudflare',
      location: 'Global CDN',
      distance: 0,
      ping: 0,
    };
  }

  private calculateJitter(pings: number[]): number {
    if (pings.length < 2) return 0;
    
    let jitterSum = 0;
    for (let i = 1; i < pings.length; i++) {
      jitterSum += Math.abs(pings[i] - pings[i - 1]);
    }
    
    return jitterSum / (pings.length - 1);
  }

  private mapNetworkType(type: string | null): 'wifi' | 'cellular' | 'unknown' {
    switch (type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      default:
        return 'unknown';
    }
  }

  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateProgress(state: SpeedTestState, progress: number): void {
    this.progressCallback?.({
      state,
      progress,
    });
  }

  private checkShouldStop(): void {
    if (this.shouldStop) {
      throw this.createError('unknown-error', 'Test was stopped by user');
    }
  }

  private createError(type: SpeedTestError, message: string): SpeedTestErrorInfo {
    return {
      type,
      message,
      details: { timestamp: new Date().toISOString() },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async saveTestResult(result: SpeedTestResult): Promise<void> {
    try {
      const key = 'speedtest_history';
      const existingData = await AsyncStorage.getItem(key);
      const history: SpeedTestResult[] = existingData ? JSON.parse(existingData) : [];
      
      history.unshift(result);
      
      // Keep only last 50 results
      if (history.length > SPEED_TEST_CONSTANTS.MAX_HISTORY_ITEMS) {
        history.splice(SPEED_TEST_CONSTANTS.MAX_HISTORY_ITEMS);
      }
      
      await AsyncStorage.setItem(key, JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save test result:', error);
    }
  }
}

// ===============================
// FACTORY FUNCTION
// ===============================

export const createSpeedTestService = (
  progressCallback?: (progress: SpeedTestProgress) => void
): ISpeedTestService => {
  return new SpeedTestService(progressCallback);
};