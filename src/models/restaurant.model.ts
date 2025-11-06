
export interface Restaurant {
  name: string;
  address: string;
  city: string;
  category: string;
  tags: string;
  hours: { [key: string]: string };
  maxCapacity: number;
  description: string;
  bookingLink: string;
  gPlaceId?: string;
}
