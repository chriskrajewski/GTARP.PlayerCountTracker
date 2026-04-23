"use client"

import type React from "react"

import { useState } from "react"
import { Check, ChevronsUpDown, X, Server } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ServerData } from "@/lib/data"
import { motion, AnimatePresence } from "motion/react"

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
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between sm:w-[320px] transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
              borderColor: open ? 'rgba(0, 217, 255, 0.4)' : 'rgba(0, 217, 255, 0.15)',
              boxShadow: open ? '0 0 20px rgba(0, 217, 255, 0.1)' : 'none',
            }}
            disabled={disabled}
          >
            {selectedServers.length > 0 ? (
              <div className="flex flex-wrap gap-1 max-w-[260px] overflow-hidden">
                <AnimatePresence mode="popLayout">
                  {selectedServers.length <= 2 ? (
                    selectedServers.map((serverId) => (
                      <motion.div
                        key={serverId}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Badge variant="default" className="mr-1 gap-1">
                          {getServerNameById(serverId)}
                          <span
                            role="button"
                            tabIndex={0}
                            className="ml-0.5 rounded-full outline-none hover:bg-cyan-400/20 p-0.5 transition-colors cursor-pointer"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            onClick={(e) => removeServer(serverId, e)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                removeServer(serverId, e as unknown as React.MouseEvent)
                              }
                            }}
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Remove {getServerNameById(serverId)}</span>
                          </span>
                        </Badge>
                      </motion.div>
                    ))
                  ) : (
                    <motion.span 
                      className="bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {selectedServers.length} servers selected
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <span className="flex items-center gap-2 text-gray-400">
                <Server className="h-4 w-4 text-cyan-400/60" />
                Select servers
              </span>
            )}
            <ChevronsUpDown className={cn(
              "ml-2 h-4 w-4 shrink-0 transition-all duration-300",
              open ? "text-cyan-400 rotate-180" : "text-gray-500"
            )} />
          </Button>
        </motion.div>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
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
                  <motion.div
                    initial={false}
                    animate={{ 
                      scale: selectedServers.includes(server.server_id) ? 1 : 0.8,
                      opacity: selectedServers.includes(server.server_id) ? 1 : 0.3
                    }}
                    transition={{ duration: 0.15 }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 text-cyan-400",
                        selectedServers.includes(server.server_id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </motion.div>
                  <span className={cn(
                    "transition-colors",
                    selectedServers.includes(server.server_id) ? "text-white font-medium" : "text-gray-400"
                  )}>
                    {server.server_name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
