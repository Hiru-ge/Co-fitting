export interface User {
  id: number;
  email: string;
  display_name: string;
  search_radius: number;
  enable_adult_venues: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  level: number;
  total_xp: number;
  streak_count: number;
  streak_last: string | null;
  total_visits: number;
  breakout_visits: number;
  challenge_visits: number;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon_url: string;
}

export interface EarnedBadge extends Badge {
  earned_at: string;
}

export interface Proficiency {
  genre_tag_id: number;
  genre_name: string;
  category: string;
  icon: string;
  xp: number;
  level: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
}
