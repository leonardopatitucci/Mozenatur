
export interface School {
  id: string;
  name: string;
  address: string;
  morningEntry: string; // HH:mm (Manhã)
  morningExit: string;  // HH:mm (Manhã)
  afternoonEntry: string; // HH:mm (Tarde)
  afternoonExit: string;  // HH:mm (Tarde)
  stopDuration: number; // Tempo de parada em minutos
}

export interface Van {
  id: string;
  vanNumber: string;
  model: string;
  plate: string;
  driverName: string;
  capacity: number;
  startAddress: string; // Endereço de início da jornada
}

export type Shift = 'MANHA' | 'TARDE';
export type RoutePeriod = 'CEDO' | 'ALMOCO' | 'FINAL_TARDE';
export type DayOfWeek = 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX';

export interface Student {
  id: string;
  name: string;
  address: string;
  schoolId: string;
  vanId: string;
  shift: Shift;
  daysOfWeek: DayOfWeek[]; // Dias em que o aluno utiliza o transporte
  goesToSchool: boolean;   // Utiliza o transporte na IDA (casa -> escola)
  returnsFromSchool: boolean; // Utiliza o transporte na VOLTA (escola -> casa)
  pickupWindowStart: string;
  pickupWindowEnd: string;
  stopDuration: number; // Tempo de embarque em minutos
  isPresent?: boolean;
  notified?: boolean;
}

export interface RouteStep {
  time: string;
  location: string;
  lat: number;
  lng: number;
  type: 'PICKUP' | 'DROPOFF' | 'START' | 'END';
  description: string;
  studentIds?: string[]; 
  schoolId?: string;
  trafficStatus?: 'LIGHT' | 'MODERATE' | 'HEAVY';
  travelTimeFromPrevious?: string;
  distanceFromPrevious?: string;
}

export interface RouteAnalysis {
  summary: string;
  steps: RouteStep[];
}
