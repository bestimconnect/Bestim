/** Picture per car type (decisions Q52). */
const art: Record<string, number> = {
  sedan: require('@/assets/images/vehicles/sedan.png'),
  hatchback: require('@/assets/images/vehicles/hatchback.png'),
  suv: require('@/assets/images/vehicles/suv.png'),
  coupe: require('@/assets/images/vehicles/coupe.png'),
  sports: require('@/assets/images/vehicles/sports.png'),
  convertible: require('@/assets/images/vehicles/convertible.png'),
  pickup: require('@/assets/images/vehicles/pickup.png'),
  van: require('@/assets/images/vehicles/van.png'),
};

/** The picture for a type; rows saved before cars-only ('car', 'motorcycle', 'equipment') get the sedan. */
export const vehicleArt = (type: string) => art[type] ?? art.sedan;
