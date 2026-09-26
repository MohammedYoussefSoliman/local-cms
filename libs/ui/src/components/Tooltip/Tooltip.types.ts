import type { Content } from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';


export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof Content>['side'];
  align?: ComponentProps<typeof Content>['align'];
  /** Leave open when there is nothing to say — avoids an empty bubble. */
  disabled?: boolean;
  className?: string;
}
