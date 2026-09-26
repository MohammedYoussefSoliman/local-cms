import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '../../functions';

import type {
  TabsContentProps,
  TabsListProps,
  TabsProps,
  TabsTriggerProps,
} from './Tabs.types';

export function Tabs({ className, ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-4', className)}
      {...props}
    />
  );
}

/**
 * The underline sits on the list's own bottom border and each trigger pulls
 * itself 1px down over it — `-mb-px` rather than a second absolutely
 * positioned element, which would need `start`/`end` bookkeeping in RTL.
 */
export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex items-center gap-1 overflow-x-auto border-b border-soft-light',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        '-mb-px flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-paragraph-sm text-sub-dark transition-colors hover:text-strong focus-visible:outline-none data-[state=active]:border-primary-base data-[state=active]:text-strong',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('focus-visible:outline-none', className)}
      {...props}
    />
  );
}
