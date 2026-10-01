/** Port / commercial-capital coordinates used to draw trade routes on the globe. */
const PLACES: Record<string, [number, number]> = {
  nigeria: [6.45, 3.39], // Lagos
  ghana: [5.67, -0.02], // Tema
  "cote d'ivoire": [5.36, -4.01], // Abidjan
  "côte d'ivoire": [5.36, -4.01],
  kenya: [-4.04, 39.67], // Mombasa
  'south africa': [-29.86, 31.03], // Durban
  ethiopia: [9.03, 38.74],
  tanzania: [-6.79, 39.21],
  uganda: [0.35, 32.58],
  rwanda: [-1.95, 30.06],
  senegal: [14.72, -17.47],
  cameroon: [4.05, 9.7],
  egypt: [31.2, 29.92],
  morocco: [33.57, -7.59],
  zambia: [-15.39, 28.32],
  malawi: [-13.96, 33.79],
  'burkina faso': [12.37, -1.52],
  mali: [12.64, -8.0],
  benin: [6.37, 2.39],
  togo: [6.13, 1.22],
  netherlands: [51.92, 4.48], // Rotterdam
  belgium: [51.22, 4.4],
  germany: [53.55, 9.99],
  france: [48.85, 2.35],
  spain: [40.42, -3.7],
  italy: [41.9, 12.5],
  'united kingdom': [51.5, -0.12],
  'united states': [40.71, -74.0],
  'united arab emirates': [25.2, 55.27],
  'saudi arabia': [21.49, 39.19],
  turkey: [41.01, 28.98],
  india: [19.07, 72.88],
  china: [31.23, 121.47],
  vietnam: [10.82, 106.63],
  japan: [34.69, 135.5],
  'south korea': [37.57, 126.98],
  brazil: [-23.55, -46.63],
};

export function placeOf(country: string): [number, number] | undefined {
  return PLACES[country.trim().toLowerCase()];
}
