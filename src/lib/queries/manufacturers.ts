import { db } from "@/db";
import { leads, locations, manufacturerProfiles, products } from "@/db/schema";
import { and, eq, ilike, inArray, isNull, lt, gte, or, sql, desc, countDistinct, arrayOverlaps } from "drizzle-orm";

/**
 * Fetch manufacturers with search, filtering and pagination.
 * 
 * Supports:
 * - Full-text search (q) across lead name, url, products, CAS, locations, and industries.
 * - Industry filter (array overlap).
 * - Status filter (multi-select).
 * - Location filter (state-based, multi-select).
 * - Capacity filter (bucketed).
 * - Pagination (50 per page).
 */
export async function getManufacturers({
  q,
  industry,
  status,
  location,
  capacity,
  page = 1,
}: {
  q?: string;
  industry?: string[];
  status?: string[];
  location?: string[];
  capacity?: string[];
  page?: number;
}) {
  const limit = 50;
  const offset = (page - 1) * limit;

  const whereConditions = [];

  if (q) {
    const searchPattern = `%${q}%`;
    whereConditions.push(
      or(
        ilike(leads.name, searchPattern),
        ilike(leads.url, searchPattern),
        ilike(products.name, searchPattern),
        ilike(products.casNumber, searchPattern),
        ilike(locations.city, searchPattern),
        ilike(locations.state, searchPattern),
        ilike(locations.country, searchPattern),
        sql`${manufacturerProfiles.industriesServed}::text ilike ${searchPattern}`
      )
    );
  }

  if (industry && industry.length > 0) {
    whereConditions.push(arrayOverlaps(manufacturerProfiles.industriesServed, industry));
  }

  if (status && status.length > 0) {
    whereConditions.push(inArray(leads.status, status as any));
  }

  if (location && location.length > 0) {
    whereConditions.push(inArray(locations.state, location));
  }

  if (capacity && capacity.length > 0) {
    const capacityConditions = [];
    for (const bucket of capacity) {
      if (bucket === "Unknown") {
        capacityConditions.push(isNull(manufacturerProfiles.capacityMtPerYear));
      } else if (bucket === "<100") {
        capacityConditions.push(lt(manufacturerProfiles.capacityMtPerYear, 100));
      } else if (bucket === "100-999") {
        capacityConditions.push(
          and(
            gte(manufacturerProfiles.capacityMtPerYear, 100),
            lt(manufacturerProfiles.capacityMtPerYear, 1000)
          )
        );
      } else if (bucket === "1000-9999") {
        capacityConditions.push(
          and(
            gte(manufacturerProfiles.capacityMtPerYear, 1000),
            lt(manufacturerProfiles.capacityMtPerYear, 10000)
          )
        );
      } else if (bucket === "10000+") {
        capacityConditions.push(gte(manufacturerProfiles.capacityMtPerYear, 10000));
      }
    }
    if (capacityConditions.length > 0) {
      whereConditions.push(or(...capacityConditions));
    }
  }

  // Subquery to get the lead IDs that match the criteria
  const leadIdsQuery = db
    .select({
      id: leads.id,
    })
    .from(leads)
    .leftJoin(manufacturerProfiles, eq(leads.id, manufacturerProfiles.leadId))
    .leftJoin(products, eq(manufacturerProfiles.id, products.profileId))
    .leftJoin(locations, eq(manufacturerProfiles.id, locations.profileId))
    .where(and(...whereConditions))
    .groupBy(leads.id)
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCountResult = await db
    .select({ count: countDistinct(leads.id) })
    .from(leads)
    .leftJoin(manufacturerProfiles, eq(leads.id, manufacturerProfiles.leadId))
    .leftJoin(products, eq(manufacturerProfiles.id, products.profileId))
    .leftJoin(locations, eq(manufacturerProfiles.id, locations.profileId))
    .where(and(...whereConditions));

  const total = Number(totalCountResult[0]?.count || 0);
  const leadIds = (await leadIdsQuery).map((r) => r.id);

  let data: any[] = [];
  if (leadIds.length > 0) {
    data = await db.query.leads.findMany({
      where: inArray(leads.id, leadIds),
      with: {
        manufacturerProfiles: {
          with: {
            products: true,
            locations: true,
          },
        },
      },
      orderBy: [desc(leads.createdAt)],
    });
  }

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Fetch full details for a single manufacturer by leadId.
 */
export async function getManufacturerDetail(leadId: number) {
  const leadData = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
    with: {
      manufacturerProfiles: {
        with: {
          products: true,
          contacts: true,
          locations: true,
        },
      },
      manufacturerPages: true,
    },
  });

  return leadData;
}
