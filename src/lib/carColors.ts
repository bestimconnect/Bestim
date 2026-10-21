// The colours an owner can pick for a car. Saved in vehicles.color as the id (white, black …); the name is translated on screen.
export const CAR_COLORS = [
  { id: 'white', hex: '#FFFFFF' },
  { id: 'black', hex: '#1B1F1D' },
  { id: 'silver', hex: '#C4C9CC' },
  { id: 'grey', hex: '#7A8084' },
  { id: 'red', hex: '#C8283C' },
  { id: 'blue', hex: '#2D5FA8' },
  { id: 'green', hex: '#2E7D4F' },
  { id: 'yellow', hex: '#E8C22A' },
  { id: 'orange', hex: '#E27A24' },
  { id: 'brown', hex: '#6B4A33' },
  { id: 'beige', hex: '#D8C8A8' },
  { id: 'gold', hex: '#B8963E' },
] as const;
