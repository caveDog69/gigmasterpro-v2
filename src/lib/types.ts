export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';
export type CommitmentLevel = 'casual' | 'serious' | 'professional';

export interface User {
  id: number;
  email: string;
  email_verified: boolean;
  created_at: string;
}

export interface Profile {
  id: number;
  username: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  zip?: string | null;
  phone?: string | null;
  instrument: string | null;
  genre: string | null;
  avatar_url: string | null;
  website: string | null;
  instruments: string[];
  experience_level: ExperienceLevel | null;
  commitment_level: CommitmentLevel | null;
  equipment: string | null;
  is_public: boolean;
  calendar_token?: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileBrief = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'city' | 'state' | 'instrument' | 'genre'>;

export interface Song {
  id: number;
  user_id: number;
  title: string;
  artist: string;
  album: string;
  release_date: string | null;
  key: string;
  tempo: number;
  duration: number;
  genre: string;
  guitar_tuning: string;
  lyrics?: string | null;
  chords?: string | null;
  notes: string | null;
  is_original: boolean;
  has_lyrics?: boolean;
  has_chords?: boolean;
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  source: 'catalog' | 'lrclib';
  catalog_id: number | null;
  lrclib_id: number | null;
  title: string;
  artist: string;
  album: string;
  release_date: string | null;
  duration: number;
  genre: string;
  key: string;
  tempo: number | null;
  lyrics: string;
  times_imported?: number;
}

export interface SetlistEntry {
  id: number;
  setlist_id: number;
  song_id: number;
  position: number;
  notes: string | null;
  song: Song;
}

export interface Setlist {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  duration: number;
  is_public: boolean;
  song_count?: number;
  songs?: SetlistEntry[];
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
}

export type GigStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

export interface GigSetlistLink {
  id: number;
  gig_id: number;
  setlist_id: number;
  position: number;
  setlist: Setlist & { songs: SetlistEntry[] };
}

export interface Gig {
  id: number;
  user_id: number;
  name: string;
  venue: string | null;
  location: string | null;
  date_time: string;
  load_in_time: string | null;
  duration: number;
  notes: string | null;
  payment: number | null;
  status: GigStatus;
  setlist_count?: number;
  setlists?: GigSetlistLink[];
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaySong extends Song {
  entry_notes: string | null;
  song_position: number;
  setlist_position: number;
  setlist_name: string;
  setlist_id: number;
}

export interface PlayModeSettings {
  lyrics: { content: 'lyrics' | 'chords' | 'both'; header_fields: string[]; show_artist: boolean };
  songs: { fields: string[] };
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Connection {
  id: number;
  requester_id: number;
  recipient_id: number;
  status: ConnectionStatus;
  message: string | null;
  requester: ProfileBrief;
  recipient: ProfileBrief;
  created_at: string;
  updated_at: string;
}

export interface CommunityProfile extends Profile {
  distance_miles: number | null;
  connection_status: 'none' | 'connected' | 'pending_sent' | 'pending_received' | 'declined';
  connection_id: number | null;
  unread_count: number;
}

export interface Conversation {
  id: number;
  participant_1_id: number;
  participant_2_id: number;
  last_message_at: string;
  last_message_content: string | null;
  last_message_sender_id: number | null;
  unread_count: number;
  other_participant: ProfileBrief;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
  actor: ProfileBrief | null;
}

export interface NotificationSummary {
  unread_notifications: number;
  unread_messages: number;
  pending_connections: number;
  pending_band_invitations: number;
  latest_notification_id: number;
}

export type BandRole = 'owner' | 'admin' | 'member';

export interface Band {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  is_public: boolean;
  my_role: BandRole;
  member_count?: number;
  song_count?: number;
  upcoming_gig_count?: number;
  created_at: string;
}

export interface BandMember {
  id: number;
  band_id: number;
  user_id: number;
  role: BandRole;
  can_edit: boolean;
  joined_at?: string;
  profile: ProfileBrief;
}

export interface BandShare {
  share_id: number;
  added_by: number;
  added_by_name: string;
  shared_at: string;
  id: number;
  user_id: number;
  [key: string]: unknown;
}

export interface BandInvitation {
  id: number;
  band_id: number;
  inviter_id: number;
  invitee_id: number;
  status: string;
  created_at: string;
  inviter?: ProfileBrief;
  invitee?: ProfileBrief;
  band?: { id: number; name: string; description: string | null };
}

export interface BandDetail extends Band {
  my_can_edit: boolean;
  members: BandMember[];
  songs: BandShare[];
  setlists: BandShare[];
  gigs: BandShare[];
  invitations: BandInvitation[];
}

export interface Session {
  token?: string;
  user: User;
  profile: Profile;
}
