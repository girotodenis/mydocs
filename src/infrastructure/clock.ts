import type { Clock } from '@/domain/ports'

export const clockDoNavegador: Clock = {
  agoraIso: () => new Date().toISOString(),
}
