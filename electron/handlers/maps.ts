import { ipcMain, dialog } from 'electron'
import {
  getMaps,
  createMap,
  updateMap,
  deleteMap,
  getMapPins,
  createMapPin,
  deleteMapPin,
} from '../../src/main/maps/mapService'

export function registerMapHandlers() {
  ipcMain.handle('maps:list', (_event, campaignId: string) =>
    getMaps(campaignId)
  )

  ipcMain.handle('maps:create', (_event, data: { campaignId: string; name: string; imagePath?: string }) =>
    createMap(data)
  )

  ipcMain.handle('maps:update', (_event, id: string, campaignId: string, data: { name?: string; imagePath?: string | null }) =>
    updateMap(id, campaignId, data)
  )

  ipcMain.handle('maps:delete', async (_event, id: string, campaignId: string) => {
    await deleteMap(id, campaignId)
    return { success: true }
  })

  ipcMain.handle('maps:getPins', (_event, mapId: string) =>
    getMapPins(mapId)
  )

  ipcMain.handle('maps:createPin', (_event, data: { mapId: string; campaignId: string; entityId: string; x: number; y: number }) =>
    createMapPin(data)
  )

  ipcMain.handle('maps:deletePin', async (_event, id: string) => {
    await deleteMapPin(id)
    return { success: true }
  })

  ipcMain.handle('maps:pickImage', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Map Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
