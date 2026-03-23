// constants/bannerImages.ts
// Images de bandeau pour l'identité visuelle football.
// Phase 1 : URLs Pexels (gratuites). Phase 2 : remplacer par des assets locaux require().

export type BannerKey =
  | "home"
  | "force"
  | "engine"
  | "explosif"
  | "foundation"
  | "celebration"
  | "welcome"
  | "empty";

// Pexels — images libres de droits, compressées côté CDN via ?auto=compress&w=1080
export const BANNER_IMAGES: Record<BannerKey, { uri: string }> = {
  // Terrain au crépuscule — ambiance, premier contact avec l'app
  home: {
    uri: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&fit=crop",
  },
  // Salle / haltères — puissance, détermination
  force: {
    uri: "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&fit=crop",
  },
  // Joueur qui court sur piste / terrain — endurance
  engine: {
    uri: "https://images.pexels.com/photos/3764014/pexels-photo-3764014.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&fit=crop",
  },
  // Sprint / démarrage — vitesse, explosivité
  explosif: {
    uri: "https://images.pexels.com/photos/3621185/pexels-photo-3621185.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&fit=crop",
  },
  // Étirements / récupération — calme
  foundation: {
    uri: "https://images.pexels.com/photos/6455927/pexels-photo-6455927.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&fit=crop",
  },
  // Célébration / victoire
  celebration: {
    uri: "https://images.pexels.com/photos/3148452/pexels-photo-3148452.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&fit=crop",
  },
  // Terrain grand angle — accueil
  welcome: {
    uri: "https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
  },
  // Terrain vide — état vide
  empty: {
    uri: "https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop",
  },
};

// Couleurs de fallback si l'image ne charge pas — bandeau uni avec ambiance
export const BANNER_FALLBACK: Record<BannerKey, string> = {
  home: "#0f1f0f",       // vert très sombre (terrain de nuit)
  force: "#1f140a",      // brun sombre (salle)
  engine: "#0a141f",     // bleu sombre (extérieur)
  explosif: "#1f0a0a",   // rouge sombre (intensité)
  foundation: "#0a1f14", // vert calme
  celebration: "#1f1a0a",// doré sombre
  welcome: "#0a140a",    // vert nuit
  empty: "#141414",      // gris sombre
};

// Images pour le carrousel WelcomeScreen (crossfade automatique)
export const WELCOME_CAROUSEL = [
  BANNER_IMAGES.welcome,   // Stade grand angle
  BANNER_IMAGES.home,      // Terrain au crépuscule
  BANNER_IMAGES.engine,    // Joueur qui court
  BANNER_IMAGES.force,     // Salle de muscu
  BANNER_IMAGES.explosif,  // Sprint
];

// Mapping cycle → clé de bannière
export function cycleToBannerKey(cycle?: string | null): BannerKey {
  const c = (cycle ?? "").toLowerCase();
  if (c.includes("force")) return "force";
  if (c.includes("fondation") || c.includes("foundation")) return "foundation";
  if (c.includes("endurance") || c.includes("engine")) return "engine";
  if (c.includes("rsa")) return "engine";
  if (c.includes("explosi") || c.includes("vitesse") || c.includes("puissance")) return "explosif";
  if (c.includes("saison") || c.includes("maintien")) return "engine";
  if (c.includes("offseason") || c.includes("transition")) return "foundation";
  return "home";
}
