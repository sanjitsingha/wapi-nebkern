"use client"

import { useState } from 'react'
import { Check, ChevronDown, Search, Users } from 'lucide-react'
import { useTeamMembers } from '@/hooks/reference-data'
import type { Profile } from '@/types'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface TeamMemberSelectorProps {
  value: Profile | null
  onChange: (member: Profile | null) => void
  disabled?: boolean
}

/**
 * Team member filter dropdown for the dashboard header.
 * Sits beside the DateRangeSelector to scope all dashboard analytics
 * (metrics, conversation trends, pipeline, response times, and activity)
 * to a specific team member, or view aggregated account-wide data.
 */
export function TeamMemberSelector({
  value,
  onChange,
  disabled = false,
}: TeamMemberSelectorProps) {
  const { data: members = [], isLoading } = useTeamMembers()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  // Filter members by name or email when searching
  const query = search.trim().toLowerCase()
  const filteredMembers = query
    ? members.filter(
        (m) =>
          (m.full_name && m.full_name.toLowerCase().includes(query)) ||
          (m.email && m.email.toLowerCase().includes(query))
      )
    : members

  const initials = (name: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      return parts[0].slice(0, 2).toUpperCase()
    }
    if (email) return email.slice(0, 2).toUpperCase()
    return 'TM'
  }

  const selectedName = value ? value.full_name || value.email || 'Team member' : null

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <DropdownMenuTrigger
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-between rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground hover:bg-muted font-normal h-10 shrink-0 gap-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
          value && 'border-primary/40 bg-primary/5 text-foreground'
        )}
        aria-label="Filter by team member"
      >
        {value ? (
          <div className="flex items-center gap-2">
            <Avatar className="size-5 shrink-0 ring-1 ring-border">
              {value.avatar_url && (
                <AvatarImage
                  src={value.avatar_url}
                  alt={selectedName || 'Avatar'}
                />
              )}
              <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-medium">
                {initials(value.full_name, value.email)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[140px] sm:max-w-[180px] font-medium text-sm">
              {selectedName}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm">All team members</span>
          </div>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground/70 shrink-0 ml-0.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72 p-1.5 bg-popover border-border text-popover-foreground shadow-xl rounded-xl"
      >
        <DropdownMenuGroup>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Filter by team member
          </div>

          {members.length > 5 && (
            <div className="px-2 pb-2 pt-1">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search team member..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-muted/60 border border-border/80 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          <DropdownMenuSeparator className="bg-border/60" />

          {/* All team members option */}
          <DropdownMenuItem
            onClick={() => onChange(null)}
            className={cn(
              'flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs font-medium transition-colors',
              !value
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-foreground hover:bg-muted/80'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 ring-1 ring-border/50">
                <Users className="size-3.5" />
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="truncate">All team members</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Entire team aggregated
                </span>
              </div>
            </div>
            {!value && <Check className="size-4 shrink-0 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border/60" />

          {/* Individual members list */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin">
            {filteredMembers.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {query ? 'No matching team members' : 'No team members found'}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = value?.id === member.id
                const name = member.full_name || member.email || 'Unnamed member'

                return (
                  <DropdownMenuItem
                    key={member.id}
                    onClick={() => onChange(member)}
                    className={cn(
                      'flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground hover:bg-muted/80'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-7 shrink-0 ring-1 ring-border/50">
                        {member.avatar_url && (
                          <AvatarImage src={member.avatar_url} alt={name} />
                        )}
                        <AvatarFallback className="text-[11px] bg-secondary text-secondary-foreground font-medium">
                          {initials(member.full_name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="truncate font-medium text-foreground">
                          {name}
                        </span>
                        {member.email && (
                          <span className="truncate text-[11px] text-muted-foreground font-normal">
                            {member.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </DropdownMenuItem>
                )
              })
            )}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
