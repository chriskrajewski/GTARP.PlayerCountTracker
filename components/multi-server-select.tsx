"use client"

import type React from "react"

import { useState } from "react"
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ServerData } from "@/lib/data"

interface MultiServerSelectProps {
  servers: ServerData[]
  selectedServers: string[]
  onChange: (selectedServers: string[]) => void
  disabled?: boolean
}

export function MultiServerSelect({ servers, selectedServers, onChange, disabled = false }: MultiServerSelectProps) {
  const [open, setOpen] = useState(false)

  const toggleServer = (serverId: string) => {
    if (selectedServers.includes(serverId)) {
      onChange(selectedServers.filter((id) => id !== serverId))
    } else {
      onChange([...selectedServers, serverId])
    }
  }

  const removeServer = (serverId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedServers.filter((id) => id !== serverId))
  }

  // Get server name by ID
  const getServerNameById = (serverId: string): string => {
    const server = servers.find(s => s.server_id === serverId)
    return server ? server.server_name : `Server ${serverId}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between sm:w-[250px]"
          disabled={disabled}
        >
          {selectedServers.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-w-[200px] overflow-hidden">
              {selectedServers.length <= 2 ? (
                selectedServers.map((serverId) => (
                  <Badge key={serverId} variant="secondary" className="mr-1">
                    {getServerNameById(serverId)}
                    <button
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onClick={(e) => removeServer(serverId, e)}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove {getServerNameById(serverId)}</span>
                    </button>
                  </Badge>
                ))
              ) : (
                <span>{selectedServers.length} servers selected</span>
              )}
            </div>
          ) : (
            "Select servers"
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search servers..." />
          <CommandList>
            <CommandEmpty>No server found.</CommandEmpty>
            <CommandGroup>
              {servers.map((server) => (
                <CommandItem
                  key={server.server_id}
                  value={server.server_id}
                  onSelect={() => {
                    toggleServer(server.server_id)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedServers.includes(server.server_id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {server.server_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
