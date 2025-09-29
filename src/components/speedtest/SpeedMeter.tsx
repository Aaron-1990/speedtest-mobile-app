/**
 * SpeedMeter Component - Componente visual principal para mostrar velocidad
 * Principio SOLID: Single Responsibility - Solo se encarga de mostrar medidor de velocidad
 * Clean Code: Componente reutilizable con props bien definidas
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SpeedMeterProps, SPEED_RANGES } from '../../types/SpeedTest';

// ===============================
// CONFIGURACIÓN DEL COMPONENTE
// ===============================

const SCREEN_WIDTH = Dimensions.get('window').width;

const SIZES = {
  small: {
    diameter: SCREEN_WIDTH * 0.6,
    strokeWidth: 8,
    fontSize: 24,
    labelFontSize: 14,
  },
  medium: {
    diameter: SCREEN_WIDTH * 0.75,
    strokeWidth: 12,
    fontSize: 32,
    labelFontSize: 16,
  },
  large: {
    diameter: SCREEN_WIDTH * 0.9,
    strokeWidth: 16,
    fontSize: 40,
    labelFontSize: 18,
  },
};

const COLORS = {
  background: '#f0f0f0',
  poor: '#FF6B6B',      // Rojo
  fair: '#FFE66D',      // Amarillo
  good: '#4ECDC4',      // Verde claro
  excellent: '#45B7D1', // Azul
  inactive: '#E0E0E0',
  text: '#333333',
  label: '#666666',
};

// ===============================
// COMPONENTE PRINCIPAL
// ===============================

export const SpeedMeter: React.FC<SpeedMeterProps> = ({
  currentSpeed,
  maxSpeed,
  testType,
  isActive,
  size = 'medium',
}) => {
  // Animaciones
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  
  // Configuración del tamaño
  const sizeConfig = SIZES[size];
  const radius = (sizeConfig.diameter - sizeConfig.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // ===============================
  // CÁLCULOS Y MEMORIZACIÓN
  // ===============================

  // Determinar color basado en velocidad
  const speedColor = useMemo(() => {
    if (!isActive) return COLORS.inactive;
    
    if (currentSpeed <= SPEED_RANGES.POOR.max) return COLORS.poor;
    if (currentSpeed <= SPEED_RANGES.FAIR.max) return COLORS.fair;
    if (currentSpeed <= SPEED_RANGES.GOOD.max) return COLORS.good;
    return COLORS.excellent;
  }, [currentSpeed, isActive]);

  // Calcular progreso (0-1)
  const progress = useMemo(() => {
    if (maxSpeed === 0) return 0;
    return Math.min(currentSpeed / maxSpeed, 1);
  }, [currentSpeed, maxSpeed]);

  // Formatear velocidad para mostrar
  const formattedSpeed = useMemo(() => {
    if (currentSpeed < 1) {
      return currentSpeed.toFixed(2);
    } else if (currentSpeed < 10) {
      return currentSpeed.toFixed(1);
    } else {
      return Math.round(currentSpeed).toString();
    }
  }, [currentSpeed]);

  // ===============================
  // EFECTOS DE ANIMACIÓN
  // ===============================

  // Animar progreso del medidor
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedProgress]);

  // Animar pulso cuando está activo
  useEffect(() => {
    if (isActive) {
      const pulse = Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]);

      const loop = Animated.loop(pulse);
      loop.start();

      return () => loop.stop();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isActive, pulseAnimation]);

  // ===============================
  // ESTILOS DINÁMICOS
  // ===============================

  const containerStyle: ViewStyle = {
    width: sizeConfig.diameter,
    height: sizeConfig.diameter,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const speedTextStyle: TextStyle = {
    fontSize: sizeConfig.fontSize,
    fontWeight: 'bold',
    color: isActive ? speedColor : COLORS.text,
  };

  const labelTextStyle: TextStyle = {
    fontSize: sizeConfig.labelFontSize,
    color: COLORS.label,
    marginTop: 8,
  };

  // ===============================
  // RENDER
  // ===============================

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Círculo de fondo */}
      <View style={styles.circleContainer}>
        <View
          style={[
            styles.backgroundCircle,
            {
              width: sizeConfig.diameter,
              height: sizeConfig.diameter,
              borderRadius: sizeConfig.diameter / 2,
              borderWidth: sizeConfig.strokeWidth,
              borderColor: COLORS.background,
            },
          ]}
        />

        {/* Círculo de progreso animado */}
        <Animated.View
          style={[
            styles.progressCircle,
            {
              width: sizeConfig.diameter,
              height: sizeConfig.diameter,
              borderRadius: sizeConfig.diameter / 2,
              borderWidth: sizeConfig.strokeWidth,
              borderColor: speedColor,
              transform: [
                { scale: pulseAnimation },
                { rotate: '-90deg' }, // Empezar desde arriba
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.progressMask,
              {
                width: sizeConfig.diameter - sizeConfig.strokeWidth * 2,
                height: sizeConfig.diameter - sizeConfig.strokeWidth * 2,
                borderRadius: (sizeConfig.diameter - sizeConfig.strokeWidth * 2) / 2,
                backgroundColor: 'white',
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Contenido central */}
      <View style={styles.centerContent}>
        <Text style={speedTextStyle}>
          {formattedSpeed}
        </Text>
        <Text style={styles.unitText}>Mbps</Text>
        <Text style={labelTextStyle}>
          {testType === 'download' ? 'Download' : 'Upload'}
        </Text>
        
        {/* Indicador de estado */}
        {isActive && (
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: speedColor }]} />
            <Text style={styles.statusText}>Testing...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ===============================
// COMPONENTE DE PROGRESO CIRCULAR
// ===============================

interface CircularProgressProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size,
  strokeWidth,
  color,
  backgroundColor = COLORS.background,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size }}>
      {/* Círculo de fondo */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: backgroundColor,
        }}
      />
      
      {/* Círculo de progreso */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          transform: [{ rotate: `${progress * 360 - 90}deg` }],
        }}
      />
    </View>
  );
};

// ===============================
// ESTILOS
// ===============================

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  circleContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  backgroundCircle: {
    position: 'absolute',
  },
  
  progressCircle: {
    position: 'absolute',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  
  progressMask: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [
      { translateX: -50 },
      { translateY: -50 },
    ],
  },
  
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  
  unitText: {
    fontSize: 14,
    color: COLORS.label,
    marginTop: -4,
  },
  
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  
  statusText: {
    fontSize: 12,
    color: COLORS.label,
    fontStyle: 'italic',
  },
});

// ===============================
// EXPORT POR DEFECTO
// ===============================

export default SpeedMeter;