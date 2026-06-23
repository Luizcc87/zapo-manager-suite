export interface Contact {
  id: string;
  name?: string;
  notify?: string;
  imgUrl?: string | null;
}

export type FindContactsResponse = Contact[];
