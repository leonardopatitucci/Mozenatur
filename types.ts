
export interface School {
  id: string;
  name: string;
  address: string;
  entryTime: string; // HH:mm
  exitTime: string;  // HH:mm
  stopDuration: number; // Tempo de parada em minutos
}

export interface Van {
  id:string;
  vanNumber: string;
  model: string;
  plate: string;
  driverName: string;
  capacity: number;
  startAddress: string; 
}

export interface Student {
  id: string;
  name: string;
  address: string;
  schoolId: string;
  vanId: string;
  stopDuration: number; 
  isAbsent?: boolean; // Se o aluno vai faltar hoje
  parentPhone?: string;
}

export interface RouteStep {
  time: string;
  location: string;
  lat: number;
  lng: number;
  // FIX: Corrected typo from 'DROFF' to 'DROPOFF' to match usage in App.tsx.
  type: 'PICKUP' | 'DROPOFF' | 'START' | 'END';
  description: string;
  studentIds?: string[]; 
  schoolId?: string;
  trafficStatus?: 'LIGHT' | 'MODERATE' | 'HEAVY';
  travelTimeFromPrevious?: string;
  distanceFromPrevious?: string;
  actionUrl?: string; // Link direto para navegação
}

export interface RouteAnalysis {
  summary: string;
  totalTime: string;
  totalDistance: string;
  steps: RouteStep[];
  groundingUrls?: { title: string; uri: string }[];
}