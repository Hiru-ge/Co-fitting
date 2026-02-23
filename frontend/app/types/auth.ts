export interface User {
  id: number;
  email: string;
  display_name: string;
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
  comfort_zone_visits: number;
  challenge_visits: number;
}

export interface EarnedBadge {
  id: number;
  name: string;
  description: string;
  icon_url: string;
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

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
}
