import type { BadgeProps } from '../Badge';
import type { ReactElement } from 'react';


export type StatusBadgeStatus =
  | 'completed'
  | 'pending'
  | 'failed'
  | 'information'
  | 'disabled';

export type StatusBadgeColorMapType = Record<
  StatusBadgeStatus,
  BadgeProps['color']
>;

export type StatusBadgeIconMapType = Record<StatusBadgeStatus, ReactElement>;

export type StatusBadgeProps = {
  status: StatusBadgeStatus;
  text: string;
  className?: string;
  light?: true;
  withDot?: boolean;
  /** Drops the icon and the dot, leaving the label alone in its pill. */
  textOnly?: boolean;
}
