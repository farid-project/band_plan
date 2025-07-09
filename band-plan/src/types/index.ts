export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Group {
  id: string;
  name: string;
  created_by: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  name: string;
  role_in_group: 'principal' | 'sustituto';
  created_by: string;
  roles?: Role[];
  sync_calendar?: boolean;
  calendar_url?: string;
  calendar_updated_at?: string;
}

export interface GroupMemberRole {
  id: number;
  group_member_id: string;
  role_id: string;
  created_by: string;
}

export interface Instrument {
  id: string;
  name: string;
  created_by: string;
}

export interface Song {
  id: string;
  group_id: string;
  title: string;
  artist?: string;
  duration_minutes?: number;
  key?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Setlist {
  id: string;
  group_id: string;
  name: string;
  description?: string;
  estimated_duration_minutes?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  songs?: SetlistSong[];
  medleys?: Medley[];
}

export interface SetlistSong {
  id: string;
  setlist_id: string;
  song_id: string;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  song?: Song;
}

export interface Medley {
  id: string;
  setlist_id: string;
  name: string;
  position: number;
  created_at: string;
  songs?: MedleySong[];
}

export interface MedleySong {
  id: string;
  medley_id: string;
  song_id: string;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  song?: Song;
}

export interface SetlistItem {
  id: string;
  type: 'song' | 'medley';
  position: number;
  data: SetlistSong | Medley;
}

export interface Event {
  id: number;
  name: string;
  date: string;
  time: string;
  group_id: string;
  notes?: string;
  location?: string;
  setlist_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  setlist?: Setlist;
}