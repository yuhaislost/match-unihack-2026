import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL,
});

const prisma = new PrismaClient({ adapter });

// Seed merchant user (fake auth ID — not a real Supabase user)
const SEED_AUTH_ID = randomUUID();

// East Melbourne badminton venues with real coordinates
// ─── Availability schedules ───
// Each schedule defines recurring weekly hours for a court.
// dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat

type AvailabilitySchedule = {
  /** Which days this window applies to (0=Sun..6=Sat) */
  days: number[];
  /** Start time as "HH:MM" */
  startTime: string;
  /** End time as "HH:MM" */
  endTime: string;
};

// Standard weekday + weekend patterns used across venues
const SCHEDULE_FULL_WEEK: AvailabilitySchedule[] = [
  { days: [1, 2, 3, 4, 5], startTime: "06:00", endTime: "22:00" }, // Mon-Fri
  { days: [0, 6], startTime: "08:00", endTime: "20:00" }, // Sat-Sun
];

const SCHEDULE_WEEKDAY_ONLY: AvailabilitySchedule[] = [
  { days: [1, 2, 3, 4, 5], startTime: "07:00", endTime: "21:00" },
  { days: [6], startTime: "08:00", endTime: "18:00" }, // Sat half-day
];

const SCHEDULE_EVENING_HEAVY: AvailabilitySchedule[] = [
  { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "23:00" },
  { days: [0, 6], startTime: "07:00", endTime: "21:00" },
];

const SCHEDULE_COMMUNITY: AvailabilitySchedule[] = [
  { days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "20:00" },
  { days: [0, 6], startTime: "09:00", endTime: "17:00" },
];

// ─── Upsell item templates ───
type UpsellTemplate = {
  name: string;
  description: string;
  price: number;
};

const UPSELLS_FULL: UpsellTemplate[] = [
  {
    name: "Racket rental",
    description: "Quality badminton racket for your session",
    price: 5,
  },
  {
    name: "Shuttlecock tube (6)",
    description: "Feather shuttlecocks — tournament grade",
    price: 12,
  },
  {
    name: "Water bottle (600ml)",
    description: "Chilled spring water",
    price: 3,
  },
  {
    name: "Sports towel",
    description: "Absorbent microfibre towel",
    price: 4,
  },
  {
    name: "Energy drink",
    description: "Electrolyte sports drink",
    price: 4.5,
  },
];

const UPSELLS_BASIC: UpsellTemplate[] = [
  {
    name: "Racket rental",
    description: "Standard badminton racket hire",
    price: 4,
  },
  {
    name: "Shuttlecock tube (3)",
    description: "Nylon shuttlecocks",
    price: 6,
  },
  {
    name: "Water bottle (600ml)",
    description: "Chilled water",
    price: 2.5,
  },
];

const UPSELLS_PREMIUM: UpsellTemplate[] = [
  {
    name: "Premium racket rental",
    description: "Yonex Astrox series racket",
    price: 10,
  },
  {
    name: "Shuttlecock tube (12)",
    description: "Yonex AS-50 feather shuttlecocks",
    price: 22,
  },
  {
    name: "Grip tape",
    description: "Fresh overgrip tape",
    price: 3,
  },
  {
    name: "Coconut water",
    description: "Cold-pressed coconut water",
    price: 5,
  },
  {
    name: "Protein bar",
    description: "Post-game protein snack",
    price: 4,
  },
  {
    name: "Court-side coaching (30 min)",
    description: "One-on-one tips from an accredited coach",
    price: 35,
  },
];

// East Melbourne badminton venues with real coordinates
const VENUES = [
  {
    name: "Melbourne Badminton Centre",
    description:
      "Premier badminton facility in East Melbourne with international-standard courts, coaching programs, and a pro shop.",
    address: "1 Bowen Crescent, Melbourne VIC 3002",
    latitude: -37.818,
    longitude: 145.003,
    courts: [
      { name: "Court 1", capacity: 4, hourlyRate: 18 },
      { name: "Court 2", capacity: 4, hourlyRate: 18 },
      { name: "Court 3", capacity: 4, hourlyRate: 22 },
      { name: "Court 4", capacity: 4, hourlyRate: 22 },
    ],
    schedule: SCHEDULE_FULL_WEEK,
    upsells: UPSELLS_PREMIUM,
  },
  {
    name: "Box Hill Badminton Hall",
    description:
      "Community badminton hall with well-maintained courts. Popular for social games and weekend competitions.",
    address: "545 Station St, Box Hill VIC 3128",
    latitude: -37.819,
    longitude: 145.1218,
    courts: [
      { name: "Court A", capacity: 4, hourlyRate: 15 },
      { name: "Court B", capacity: 4, hourlyRate: 15 },
      { name: "Court C", capacity: 4, hourlyRate: 15 },
    ],
    schedule: SCHEDULE_COMMUNITY,
    upsells: UPSELLS_BASIC,
  },
  {
    name: "Nunawading Badminton Centre",
    description:
      "Dedicated badminton venue with 8 courts, regular social sessions, and coaching available for all levels.",
    address: "7-9 Rooks Rd, Nunawading VIC 3131",
    latitude: -37.818,
    longitude: 145.176,
    courts: [
      { name: "Court 1", capacity: 4, hourlyRate: 16 },
      { name: "Court 2", capacity: 4, hourlyRate: 16 },
      { name: "Court 3", capacity: 4, hourlyRate: 16 },
      { name: "Court 4", capacity: 4, hourlyRate: 20 },
      { name: "Court 5", capacity: 4, hourlyRate: 20 },
    ],
    schedule: SCHEDULE_EVENING_HEAVY,
    upsells: UPSELLS_FULL,
  },
  {
    name: "Blackburn Badminton Club",
    description:
      "Friendly local club with affordable court hire. Great for beginners and social players in the Blackburn area.",
    address: "53 Central Rd, Blackburn VIC 3130",
    latitude: -37.8194,
    longitude: 145.1504,
    courts: [
      { name: "Court 1", capacity: 4, hourlyRate: 12 },
      { name: "Court 2", capacity: 4, hourlyRate: 12 },
    ],
    schedule: SCHEDULE_COMMUNITY,
    upsells: UPSELLS_BASIC,
  },
  {
    name: "Doncaster Badminton Centre",
    description:
      "Modern facility in Doncaster with spring-loaded wooden floors and professional lighting. Hosts regular tournaments.",
    address: "100 Tunstall Rd, Doncaster VIC 3108",
    latitude: -37.7845,
    longitude: 145.131,
    courts: [
      { name: "Court 1", capacity: 4, hourlyRate: 20 },
      { name: "Court 2", capacity: 4, hourlyRate: 20 },
      { name: "Court 3", capacity: 4, hourlyRate: 20 },
      { name: "Court 4", capacity: 4, hourlyRate: 24 },
    ],
    schedule: SCHEDULE_FULL_WEEK,
    upsells: UPSELLS_FULL,
  },
  {
    name: "Waverley Badminton Centre",
    description:
      "Long-running badminton centre in Glen Waverley. Suitable for competitive and social play, with equipment rental available.",
    address: "289 High Street Rd, Mount Waverley VIC 3149",
    latitude: -37.8722,
    longitude: 145.1294,
    courts: [
      { name: "Court 1", capacity: 4, hourlyRate: 14 },
      { name: "Court 2", capacity: 4, hourlyRate: 14 },
      { name: "Court 3", capacity: 4, hourlyRate: 14 },
      { name: "Court 4", capacity: 4, hourlyRate: 18 },
    ],
    schedule: SCHEDULE_WEEKDAY_ONLY,
    upsells: UPSELLS_FULL,
  },
  {
    name: "Camberwell Sports Centre",
    description:
      "Multi-sport facility with dedicated badminton courts. Central Camberwell location with good public transport access.",
    address: "292 Camberwell Rd, Camberwell VIC 3124",
    latitude: -37.8388,
    longitude: 145.072,
    courts: [
      { name: "Badminton 1", capacity: 4, hourlyRate: 17 },
      { name: "Badminton 2", capacity: 4, hourlyRate: 17 },
      { name: "Badminton 3", capacity: 4, hourlyRate: 17 },
    ],
    schedule: SCHEDULE_WEEKDAY_ONLY,
    upsells: UPSELLS_BASIC,
  },
  {
    name: "Ringwood Badminton Association",
    description:
      "Community-run badminton association with affordable social nights and junior development programs.",
    address: "Jubilee Park, Mt Dandenong Rd, Ringwood VIC 3134",
    latitude: -37.8137,
    longitude: 145.2291,
    courts: [
      { name: "Court 1", capacity: 4, hourlyRate: 13 },
      { name: "Court 2", capacity: 4, hourlyRate: 13 },
      { name: "Court 3", capacity: 4, hourlyRate: 13 },
    ],
    schedule: SCHEDULE_EVENING_HEAVY,
    upsells: UPSELLS_BASIC,
  },
];

async function main() {
  console.log("Seeding east Melbourne badminton venues...\n");

  // Create a seed merchant user
  const user = await prisma.user.upsert({
    where: { authUserId: SEED_AUTH_ID },
    update: {},
    create: {
      authUserId: SEED_AUTH_ID,
      role: "MERCHANT",
      email: "seedmerchant@match.local",
      displayName: "Melbourne Badminton Venues",
    },
  });

  const merchant = await prisma.merchantProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      businessName: "Melbourne Badminton Venues",
    },
  });

  // Clean up existing seed data from this merchant
  const existingVenues = await prisma.venue.findMany({
    where: { merchantId: merchant.id },
    select: { id: true },
  });
  const venueIds = existingVenues.map((v) => v.id);

  if (venueIds.length > 0) {
    console.log(
      `  Cleaning up ${venueIds.length} existing venues from seed merchant...`,
    );

    const courtIds = (
      await prisma.court.findMany({
        where: { venueId: { in: venueIds } },
        select: { id: true },
      })
    ).map((c) => c.id);

    // Delete in dependency order
    if (courtIds.length > 0) {
      await prisma.courtSlotHold.deleteMany({
        where: { courtId: { in: courtIds } },
      });
      await prisma.courtAvailability.deleteMany({
        where: { courtId: { in: courtIds } },
      });
    }
    await prisma.upsellItem.deleteMany({
      where: { venueId: { in: venueIds } },
    });
    await prisma.court.deleteMany({
      where: { venueId: { in: venueIds } },
    });
    await prisma.venue.deleteMany({
      where: { id: { in: venueIds } },
    });

    console.log("  Cleanup complete.\n");
  }

  let totalAvailabilities = 0;
  let totalUpsells = 0;

  for (const v of VENUES) {
    const venue = await prisma.venue.create({
      data: {
        merchantId: merchant.id,
        name: v.name,
        description: v.description,
        address: v.address,
        latitude: v.latitude,
        longitude: v.longitude,
        photoUrls: [],
      },
    });

    for (const c of v.courts) {
      const court = await prisma.court.create({
        data: {
          venueId: venue.id,
          name: c.name,
          capacity: c.capacity,
          hourlyRate: c.hourlyRate,
          photoUrls: [],
        },
      });

      // Create recurring availability for each day in the schedule
      for (const window of v.schedule) {
        for (const day of window.days) {
          await prisma.courtAvailability.create({
            data: {
              courtId: court.id,
              type: "RECURRING",
              dayOfWeek: day,
              startTime: new Date(`1970-01-01T${window.startTime}:00Z`),
              endTime: new Date(`1970-01-01T${window.endTime}:00Z`),
              isAvailable: true,
            },
          });
          totalAvailabilities++;
        }
      }
    }

    // Create upsell items for the venue
    for (const u of v.upsells) {
      await prisma.upsellItem.create({
        data: {
          venueId: venue.id,
          name: u.name,
          description: u.description,
          price: u.price,
          isActive: true,
        },
      });
      totalUpsells++;
    }

    console.log(
      `  ✓ ${v.name} (${v.courts.length} courts, ${v.schedule.reduce((sum, s) => sum + s.days.length, 0) * v.courts.length} availability windows, ${v.upsells.length} upsells)`,
    );
  }

  console.log(
    `\nSeeded ${VENUES.length} venues, ${totalAvailabilities} availability records, ${totalUpsells} upsell items.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
