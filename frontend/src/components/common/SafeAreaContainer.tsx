import React from 'react'
import { cn } from '@/lib/utils'

export interface SafeAreaContainerProps {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
}

export function SafeAreaContainer({
  children,
  className,
  as: Component = 'div',
}: SafeAreaContainerProps) {
  return (
    <Component
      className={cn(
        'w-full min-h-[100dvh] flex flex-col',
        'pt-[env(safe-area-inset-top,0px)]',
        'pb-[env(safe-area-inset-bottom,0px)]',
        'pl-[env(safe-area-inset-left,0px)]',
        'pr-[env(safe-area-inset-right,0px)]',
        className,
      )}
    >
      {children}
    </Component>
  )
}

export default SafeAreaContainer
