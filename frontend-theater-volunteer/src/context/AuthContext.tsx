import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../lib/api-client'
import type { LoginRequest, OrganizationWithRoleResponse, UserResponse } from '../types/api'

type AuthContextValue = {
  user: UserResponse | null
  isLoading: boolean
  organizations: OrganizationWithRoleResponse[]
  activeOrganization: OrganizationWithRoleResponse | null
  setActiveOrganization: (orgId: number) => void
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()
  const [activeOrgId, setActiveOrgId] = useState<number | null>(null)

  const userQuery = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: api.getCurrentUser,
    retry: false,
  })

  const orgsQuery = useQuery({
    queryKey: ['auth', 'organizations'],
    queryFn: api.listMyOrganizations,
    enabled: Boolean(userQuery.data),
  })

  useEffect(() => {
    if (!orgsQuery.data?.length) return
    if (activeOrgId && orgsQuery.data.some((org) => org.id === activeOrgId)) return
    setActiveOrgId(orgsQuery.data[0].id)
  }, [orgsQuery.data, activeOrgId])

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'organizations'] })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      setActiveOrgId(null)
      queryClient.removeQueries({ queryKey: ['auth'] })
    },
  })

  const setActiveOrganization = useCallback((orgId: number) => {
    setActiveOrgId(orgId)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const activeOrganization = orgsQuery.data?.find((org) => org.id === activeOrgId) ?? null
    return {
      user: userQuery.data ?? null,
      isLoading: userQuery.isLoading || loginMutation.isPending,
      organizations: orgsQuery.data ?? [],
      activeOrganization,
      setActiveOrganization,
      login: async (credentials: LoginRequest) => {
        await loginMutation.mutateAsync(credentials)
      },
      logout: async () => {
        await logoutMutation.mutateAsync()
      },
    }
  }, [
    activeOrgId,
    loginMutation,
    orgsQuery.data,
    setActiveOrganization,
    userQuery.data,
    userQuery.isLoading,
    logoutMutation,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
