import { Bike, CarFront, Cog, Truck, type LucideIcon } from 'lucide-react-native';

/** Picture per vehicle type (decisions Q52). `car` is the pre-picker value; equipment has no artwork yet. */
export const vehicleArt: Record<string, number> = {
  car: require('@/assets/images/vehicles/sedan.png'),
  sedan: require('@/assets/images/vehicles/sedan.png'),
  hatchback: require('@/assets/images/vehicles/hatchback.png'),
  suv: require('@/assets/images/vehicles/suv.png'),
  coupe: require('@/assets/images/vehicles/coupe.png'),
  sports: require('@/assets/images/vehicles/sports.png'),
  convertible: require('@/assets/images/vehicles/convertible.png'),
  pickup: require('@/assets/images/vehicles/pickup.png'),
  van: require('@/assets/images/vehicles/van.png'),
  motorcycle: require('@/assets/images/vehicles/scooter.png'),
};

/** Icon per type, for small badges and for types without a picture. Covers every value the DB accepts. */
export const vehicleIcons: Record<string, LucideIcon> = {
  car: CarFront, sedan: CarFront, hatchback: CarFront, suv: CarFront, coupe: CarFront, sports: CarFront, convertible: CarFront,
  pickup: Truck, van: Truck, motorcycle: Bike, equipment: Cog,
};
