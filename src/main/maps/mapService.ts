import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { getDatabase } from '../database/connection'
import { maps, mapPins } from '../database/schema'
import type { DbMap, DbMapPin } from '../database/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CampaignMap {
  id: string
  campaignId: string
  name: string
  imagePath: string | null
  createdAt: number
  updatedAt: number
}

export interface MapPin {
  id: string
  mapId: string
  campaignId: string
  entityId: string
  x: number
  y: number
  createdAt: number
}

function deserialiseMap(row: DbMap): CampaignMap {
  return {
    id: row.id,
    campaignId: row.campaignId,
    name: row.name,
    imagePath: row.imagePath ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function deserialisePin(row: DbMapPin): MapPin {
  return {
    id: row.id,
    mapId: row.mapId,
    campaignId: row.campaignId,
    entityId: row.entityId,
    x: row.x,
    y: row.y,
    createdAt: row.createdAt,
  }
}

// ---------------------------------------------------------------------------
// Maps CRUD
// ---------------------------------------------------------------------------

export async function getMaps(campaignId: string): Promise<CampaignMap[]> {
  const db = getDatabase()
  const rows = await db
    .select()
    .from(maps)
    .where(eq(maps.campaignId, campaignId))
    .orderBy(maps.createdAt)
  return rows.map(deserialiseMap)
}

export async function createMap(data: { campaignId: string; name: string; imagePath?: string }): Promise<CampaignMap> {
  const db = getDatabase()
  const now = Date.now()
  const row: DbMap = {
    id: randomUUID(),
    campaignId: data.campaignId,
    name: data.name,
    imagePath: data.imagePath ?? null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(maps).values(row)
  return deserialiseMap(row)
}

export async function updateMap(
  id: string,
  campaignId: string,
  data: { name?: string; imagePath?: string | null },
): Promise<CampaignMap> {
  const db = getDatabase()
  const now = Date.now()
  const patch: Partial<DbMap> = { updatedAt: now }
  if (data.name !== undefined) patch.name = data.name
  if (data.imagePath !== undefined) patch.imagePath = data.imagePath

  await db
    .update(maps)
    .set(patch)
    .where(and(eq(maps.id, id), eq(maps.campaignId, campaignId)))

  const rows = await db.select().from(maps).where(eq(maps.id, id))
  if (!rows[0]) throw new Error(`Map not found: ${id}`)
  return deserialiseMap(rows[0])
}

export async function deleteMap(id: string, campaignId: string): Promise<void> {
  const db = getDatabase()
  // Delete pins first (no cascade in SQLite without pragma)
  await db.delete(mapPins).where(eq(mapPins.mapId, id))
  await db.delete(maps).where(and(eq(maps.id, id), eq(maps.campaignId, campaignId)))
}

// ---------------------------------------------------------------------------
// Map pins CRUD
// ---------------------------------------------------------------------------

export async function getMapPins(mapId: string): Promise<MapPin[]> {
  const db = getDatabase()
  const rows = await db
    .select()
    .from(mapPins)
    .where(eq(mapPins.mapId, mapId))
    .orderBy(mapPins.createdAt)
  return rows.map(deserialisePin)
}

export async function createMapPin(data: {
  mapId: string
  campaignId: string
  entityId: string
  x: number
  y: number
}): Promise<MapPin> {
  const db = getDatabase()
  const row: DbMapPin = {
    id: randomUUID(),
    mapId: data.mapId,
    campaignId: data.campaignId,
    entityId: data.entityId,
    x: data.x,
    y: data.y,
    createdAt: Date.now(),
  }
  await db.insert(mapPins).values(row)
  return deserialisePin(row)
}

export async function deleteMapPin(id: string): Promise<void> {
  const db = getDatabase()
  await db.delete(mapPins).where(eq(mapPins.id, id))
}
