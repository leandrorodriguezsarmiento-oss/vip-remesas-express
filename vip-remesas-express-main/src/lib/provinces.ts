/** Provincias de Cuba: se usan para el perfil del usuario/organizador y para
 *  saber de qué provincia es cada artículo de VipShop. */
export const CUBA_PROVINCES = [
  "Pinar del Río",
  "Artemisa",
  "La Habana",
  "Mayabeque",
  "Matanzas",
  "Villa Clara",
  "Cienfuegos",
  "Sancti Spíritus",
  "Ciego de Ávila",
  "Camagüey",
  "Las Tunas",
  "Holguín",
  "Granma",
  "Santiago de Cuba",
  "Guantánamo",
  "Isla de la Juventud",
] as const;

export type CubaProvince = (typeof CUBA_PROVINCES)[number];

export const PROVINCE_STORAGE_KEY = "vip-province-v1";
