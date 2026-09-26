import type { Content, Root } from '@radix-ui/react-popover';
import type { ComponentProps, ReactNode } from 'react';


export type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof Content>['side'];
  align?: ComponentProps<typeof Content>['align'];
  className?: string;
} & ComponentProps<typeof Root>
