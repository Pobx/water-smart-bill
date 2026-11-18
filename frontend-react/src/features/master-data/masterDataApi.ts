import { apiRequest } from '@/shared/api/httpClient'
import type { Homeowner, OrganizationInfo, VillageZone } from '@/shared/types/waterSmartBill'

export const masterDataApi = {
  getOrganization: (token?: string) =>
    apiRequest<OrganizationInfo>('/api/v1/organizations', { token }),
  listZones: (token?: string) =>
    apiRequest<{ items: VillageZone[] }>('/api/v1/zones', { token }),
  listHomeowners: (token?: string, query = '') =>
    apiRequest<{ items: Homeowner[] }>(`/api/v1/users?q=${encodeURIComponent(query)}`, { token }),
}
