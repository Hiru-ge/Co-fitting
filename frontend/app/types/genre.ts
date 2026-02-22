export interface GenreTag {
  id: number;
  name: string;
  category: string;
  icon: string;
}

export interface Interest {
  genre_tag_id: number;
  name: string;
  category: string;
  icon: string;
}
