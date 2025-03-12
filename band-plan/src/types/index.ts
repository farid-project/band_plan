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

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  name: string;
  role_in_group: 'principal' | 'sustituto';
  created_by: string;
  instruments: { id: string; name: string; }[];
  sync_calendar?: boolean;
  calendar_url?: string;
  calendar_updated_at?: string;
}

export interface Instrument {
  id: string;
  name: string;
  created_by: string;
}

export interface GroupMemberInstrument {
  id: number;
  group_member_id: string;
  instrument_id: string;
  created_by: string;
}

export interface Event {
  id: number;
  name: string;
  date: string;
  time: string;
  group_id: string;
  notes?: string;
  location?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}