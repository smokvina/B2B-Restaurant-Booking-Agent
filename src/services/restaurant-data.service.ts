
import { Injectable } from '@angular/core';
import { Restaurant } from '../models/restaurant.model';

@Injectable({
  providedIn: 'root'
})
export class RestaurantDataService {

  private restaurants: Restaurant[] = [
    {
      name: "Konoba Teranino",
      address: "Ulica Širina Filipa Grabovca 1",
      city: "Split",
      category: "Restoran",
      tags: "Mediteranska, Domaća, Vegetarijanske opcije",
      hours: { monday: "12:00-23:00", tuesday: "12:00-23:00", wednesday: "12:00-23:00", thursday: "12:00-23:00", friday: "12:00-00:00", saturday: "12:00-00:00", sunday: "12:00-22:00" },
      maxCapacity: 99,
      description: "<p>Mediterranean cuisine in the heart of Split and Diocletian’s Palace! Come and visit us. We offer a wide variety of local dishes, fresh seafood, and a great selection of Croatian wines. Our ambient is perfect for large groups and special occasions.</p>",
      bookingLink: "https://example.com/teranino-booking",
      gPlaceId: "ChIJ12345"
    },
    {
      name: "Pizzeria Bepina",
      address: "Makarska ulica 16",
      city: "Split",
      category: "Pizzeria",
      tags: "Pizza, Talijanska, Gluten-free opcije",
      hours: { monday: "11:00-23:00", tuesday: "11:00-23:00", wednesday: "11:00-23:00", thursday: "11:00-23:00", friday: "11:00-00:00", saturday: "11:00-00:00", sunday: "11:00-23:00" },
      maxCapacity: 50,
      description: "<p><strong>Pizzeria Bepina: Authentic Italian Pizza</strong></p> <p>Craving pizza in Split? Bepina delivers. Enjoy classic and creative pizzas made with fresh, high-quality ingredients. Our spacious terrace is ideal for groups up to 50 people.</p>",
      bookingLink: "https://example.com/bepina-booking",
      gPlaceId: "ChIJ67890"
    },
    {
        name: "Restoran Dubrovnik",
        address: "Marojice Kaboge 5",
        city: "Dubrovnik",
        category: "Fine Dining",
        tags: "Mediteranska, Plodovi mora, Luksuzno",
        hours: { monday: "18:00-23:00", tuesday: "18:00-23:00", wednesday: "18:00-23:00", thursday: "18:00-23:00", friday: "18:00-00:00", saturday: "18:00-00:00", sunday: "Closed" },
        maxCapacity: 70,
        description: "<p>Experience exquisite Mediterranean dining with a stunning view of the old city walls. Restoran Dubrovnik offers a unique culinary journey, perfect for elegant group dinners and corporate events.</p>",
        bookingLink: "https://example.com/dubrovnik-booking",
        gPlaceId: "ChIJabcde"
    },
    {
        name: "Vinodol",
        address: "Teslina ul. 10",
        city: "Zagreb",
        category: "Tradicionalna kuhinja",
        tags: "Hrvatska, Kontinentalna, Roštilj",
        hours: { monday: "12:00-00:00", tuesday: "12:00-00:00", wednesday: "12:00-00:00", thursday: "12:00-00:00", friday: "12:00-00:00", saturday: "12:00-00:00", sunday: "12:00-23:00" },
        maxCapacity: 120,
        description: "<p>A Zagreb institution, Vinodol serves the best of Croatian continental cuisine in a beautiful, historic setting. With a large capacity and multiple seating areas, we are experts at handling large tourist groups.</p>",
        bookingLink: "https://example.com/vinodol-booking",
        gPlaceId: "ChIJfghij"
    },
    {
        name: "Zrno Bio Bistro",
        address: "Medulićeva ul. 20",
        city: "Zagreb",
        category: "Veganski restoran",
        tags: "Veganska, Organska, Zdrava hrana",
        hours: { monday: "11:00-21:00", tuesday: "11:00-21:00", wednesday: "11:00-21:00", thursday: "11:00-21:00", friday: "11:00-22:00", saturday: "11:00-22:00", sunday: "Closed" },
        maxCapacity: 40,
        description: "<p>The first 100% organic vegan restaurant in Croatia. Zrno Bio Bistro offers delicious and healthy plant-based meals. Ideal for groups with specific dietary needs like vegan, vegetarian, and gluten-free.</p>",
        bookingLink: "https://example.com/zrno-booking",
        gPlaceId: "ChIJklmno"
    }
  ];

  constructor() { }

  getRestaurants(): Restaurant[] {
    return this.restaurants;
  }
}
