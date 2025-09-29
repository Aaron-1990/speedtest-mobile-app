/**
 * Definiciones de tipos para la aplicación SpeedTest
 * Principio SOLID: Interface Segregation - APIs específicas por funcionalidad
 * Evita uso de 'any', garantiza type safety
 */

// ===============================
// TIPOS CORE DE SPEED TEST
// ===============================

export interface SpeedTestResult {
  id: string;
  timestamp: Date;
  downloadSpeed: number; // Mbps
  uploadSpeed: number; // Mbps
  ping: number; // ms
  jitter: number; // ms
  packetLoss: number; // percentage
  serverInfo: ServerInfo;
  deviceInfo: DeviceInfo;
  networkInfo: NetworkInfo;
}

export interface ServerInfo {
  id: string;
  name: string;
  location: string;
  distance: number; // km
  ping: number; // ms
}

export interface DeviceInfo {
  platform: 'android' | 'ios';
  model: string;
  osVersion: string;
  appVersion: string;
}

export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'unknown';
  isConnected: boolean;
  isInternetReachable: boolean;
  carrier?: string;
  ipAddress?: string;
}

// ===============================
// ESTADOS DE LA APLICACIÓN
// ===============================

export type SpeedTestState = 
  | 'idle'
  | 'connecting'
  | 'testing-ping'
  | 'testing-download'
  | 'testing-upload'
  | 'completed'
  | 'error';

export interface SpeedTestProgress {
  state: SpeedTestState;
  progress: number; // 0-100
  currentSpeed?: number;
  estimatedTimeRemaining?: number;
}

// ===============================
// CONFIGURACIÓN Y PARÁMETROS
// ===============================

export interface SpeedTestConfig {
  testDuration: number; // seconds
  downloadTestUrl: string;
  uploadTestUrl: string;
  pingTestUrl: string;
  maxConcurrentConnections: number;
  retryAttempts: number;
  timeout: number; // ms
}

export interface TestSettings {
  autoStartOnLaunch: boolean;
  saveHistory: boolean;
  preferredServer?: string;
  testIntervalMinutes?: number;
}

// ===============================
// ERRORES Y VALIDACIÓN
// ===============================

export type SpeedTestError = 
  | 'network-unavailable'
  | 'server-unreachable'
  | 'timeout'
  | 'permission-denied'
  | 'unknown-error';

export interface SpeedTestErrorInfo {
  type: SpeedTestError;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// ===============================
// HOOKS Y CONTEXTO
// ===============================

export interface SpeedTestContextValue {
  // Estado actual
  currentTest: SpeedTestResult | null;
  progress: SpeedTestProgress;
  error: SpeedTestErrorInfo | null;
  isLoading: boolean;
  
  // Historial
  testHistory: SpeedTestResult[];
  
  // Acciones
  startTest: () => Promise<void>;
  stopTest: () => void;
  clearHistory: () => void;
  retryTest: () => Promise<void>;
}

// ===============================
// COMPONENTES UI
// ===============================

export interface SpeedMeterProps {
  currentSpeed: number;
  maxSpeed: number;
  testType: 'download' | 'upload';
  isActive: boolean;
  size?: 'small' | 'medium' | 'large';
}

export interface TestResultCardProps {
  result: SpeedTestResult;
  onPress?: () => void;
  showDetails?: boolean;
}

export interface NetworkIndicatorProps {
  networkInfo: NetworkInfo;
  style?: Record<string, unknown>;
}

// ===============================
// UTILIDADES Y CONSTANTES
// ===============================

export const SPEED_TEST_CONSTANTS = {
  MIN_TEST_DURATION: 5, // seconds
  MAX_TEST_DURATION: 60, // seconds
  DEFAULT_TIMEOUT: 30000, // ms
  PING_SAMPLES: 10,
  MAX_HISTORY_ITEMS: 50,
} as const;

export const SPEED_RANGES = {
  POOR: { min: 0, max: 5 },
  FAIR: { min: 5, max: 25 },
  GOOD: { min: 25, max: 100 },
  EXCELLENT: { min: 100, max: Infinity },
} as const;

// ===============================
// VALIDADORES DE TIPOS
// ===============================

export const isValidSpeedTestResult = (result: unknown): result is SpeedTestResult => {
  return (
    typeof result === 'object' &&
    result !== null &&
    'id' in result &&
    'downloadSpeed' in result &&
    'uploadSpeed' in result &&
    'ping' in result
  );
};

export const isNetworkAvailable = (networkInfo: NetworkInfo): boolean => {
  return networkInfo.isConnected && networkInfo.isInternetReachable;
};