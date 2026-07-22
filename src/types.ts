export interface User {
  uid: string;
  name: string;
  email: string;
  buddies: string[]; // array of buddy uids
  avatarUrl?: string;
  initials?: string;
}

export interface RouteStop {
  id: string;
  address: string;
  lat: number;
  lng: number;
  type: 'start' | 'stop' | 'end';
}

export interface JoinRequest {
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export interface LiveLocation {
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  role: 'driver' | 'passenger';
  updatedAt: number;
  active: boolean;
}

export interface Vehicle {
  id: string;
  userId: string;
  makeModel: string;
  plate: string;
  fuelCostPerKm: number;
  seats: number;
  color: string;
  fuelType?: string;
  isDefault?: boolean;
  createdAt?: number;
}

export interface Trip {
  id: string;
  driverId: string;
  driverName: string;
  title: string;
  date: string;
  time: string;
  stops: RouteStop[];
  maxPassengers: number;
  estimatedCost: number; // in TL or zł
  distanceKm: number;
  durationMin: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  passengers: string[]; // uids of approved passengers
  requests: JoinRequest[];
  recurring: boolean;
  recurringDays?: number[]; // [1, 2, 3, 4, 5] (Monday-Friday)
  liveLocations?: Record<string, LiveLocation>;
  vehicleId?: string;
  vehicleInfo?: {
    makeModel: string;
    plate?: string;
    color?: string;
    seats?: number;
    fuelCostPerKm?: number;
    fuelType?: string;
  };
}

export interface FinanceTransaction {
  id: string;
  tripId: string;
  tripTitle: string;
  date: string;
  payerId: string;
  payerName: string;
  receiverId: string;
  receiverName: string;
  amount: number;
  status: 'pending' | 'paid';
  updatedAt: number;
}

export interface RealtimeNotification {
  id: string;
  recipientId: string;
  senderName: string;
  type: 'request' | 'approval' | 'rejection' | 'payment_paid' | 'payment_received' | 'trip_created';
  message: string;
  createdAt: number;
  read: boolean;
}

export interface BuddyRequest {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

